require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const SHOPIFY_API_VERSION = '2024-01';
const DELIVERY_TAG_REGEX = /Delivery on (\d+ \w+ \d{4})/;

// Precomputed Analytics Store (Background Worker Architecture)
const analyticsStore = new Map();

// Store metadata
const storeMetadata = {
  lastUpdated: null,
  isRefreshing: false,
  refreshCount: 0,
  errors: []
};

// Analytics Contract: Fixed Time Windows
const ALLOWED_WINDOWS = [7, 30, 90, 180, 365];

// Refresh interval configuration
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Precomputed analytics configurations (Contract-based)
const ANALYTICS_CONFIGS = [
  // Customer LTV
  { type: 'ltv', days: 7 },
  { type: 'ltv', days: 30 },
  { type: 'ltv', days: 90 },
  { type: 'ltv', days: 180 },
  { type: 'ltv', days: 365 },
  // Web-to-App Conversion
  { type: 'web', days: 7 },
  { type: 'web', days: 30 },
  { type: 'web', days: 90 },
  { type: 'web', days: 180 },
  { type: 'web', days: 365 },
  // Abandoned Checkouts
  { type: 'checkout', days: 7 },
  { type: 'checkout', days: 30 },
  { type: 'checkout', days: 90 },
  { type: 'checkout', days: 180 },
  { type: 'checkout', days: 365 },
  // Delivery Slots
  { type: 'delivery', days: 7 },
  { type: 'delivery', days: 30 },
  { type: 'delivery', days: 90 },
  { type: 'delivery', days: 180 },
  { type: 'delivery', days: 365 }
];

// Node 18+ exposes fetch globally. If it is unavailable, fall back to node-fetch.
const fetchFn = (...args) => {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }

  return import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
};

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

function validateEnv() {
  if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_TOKEN) {
    throw new Error('Missing SHOPIFY_SHOP or SHOPIFY_TOKEN environment variables.');
  }
}

function getShopDomain() {
  validateEnv();
  return process.env.SHOPIFY_SHOP.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function getShopifyToken() {
  validateEnv();
  return process.env.SHOPIFY_TOKEN.trim();
}

function buildShopifyApiUrl(path) {
  return `https://${getShopDomain()}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
}

function sendError(res, error, statusCode = 500) {
  return res.status(statusCode).json({
    error: 'Shopify API error',
    details: error.message || 'Internal server error'
  });
}

function getDaysParam(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function getSinceIso(days) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString();
}

function getCustomerKey(customer) {
  if (!customer) {
    return null;
  }

  return customer.id || customer.email || customer.phone || null;
}

function normalizeChannel(sourceName) {
  if (sourceName === 'Tapcart - Mobile App') {
    return 'app';
  }

  if (sourceName === 'mobile_app') {
    return 'app';
  }

  if (sourceName === 'web') {
    return 'web';
  }

  if (sourceName === 'online_store' || sourceName === 'Online Store') {
    return 'web';
  }

  return 'other';
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Analytics Contract Validation
function validateTimeWindow(days) {
  const parsed = Number.parseInt(days, 10);
  
  if (Number.isNaN(parsed) || !ALLOWED_WINDOWS.includes(parsed)) {
    return {
      valid: false,
      error: 'Invalid time window',
      allowed: ALLOWED_WINDOWS
    };
  }
  
  return { valid: true, days: parsed };
}

// Analytics Store helper functions
function getStoreKey(type, days) {
  return `${type}:${days}`;
}

function getFromStore(key) {
  const data = analyticsStore.get(key);
  if (data) {
    console.log(`[ANALYTICS] Cache HIT: ${key}`);
    return data;
  }
  console.log(`[ANALYTICS] Cache MISS: ${key}`);
  return null;
}

function setInStore(key, data) {
  analyticsStore.set(key, data);
  console.log(`[ANALYTICS] Worker computed: ${key}`);
}

function getRetryDelayMs(retryAfterHeader) {
  if (!retryAfterHeader) {
    return 1000;
  }

  const retrySeconds = Number.parseFloat(retryAfterHeader);
  if (!Number.isNaN(retrySeconds) && retrySeconds >= 0) {
    return Math.ceil(retrySeconds * 1000);
  }

  const retryDate = new Date(retryAfterHeader);
  const retryTime = retryDate.getTime();
  if (Number.isNaN(retryTime)) {
    return 1000;
  }

  return Math.max(0, retryTime - Date.now());
}

async function shopifyRequest(url) {
  const headers = {
    'X-Shopify-Access-Token': getShopifyToken()
  };

  let response = await fetchFn(url, { headers });

  if (response.status === 429) {
    const retryDelayMs = getRetryDelayMs(response.headers.get('Retry-After'));
    await sleep(retryDelayMs);
    response = await fetchFn(url, { headers });
  }

  return response;
}

async function shopifyFetch(path) {
  const response = await shopifyRequest(buildShopifyApiUrl(path));

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shopify API error: ${response.status}${errorBody ? ` - ${errorBody}` : ''}`);
  }

  return response.json();
}

async function fetchAllOrders(since) {
  let url = `${buildShopifyApiUrl('orders.json')}?status=any&created_at_min=${encodeURIComponent(
    since
  )}&limit=250&fields=id,created_at,total_price,source_name,customer,tags,fulfillment_status`;

  const allOrders = [];
  let pageCount = 0;

  while (url) {
    pageCount++;
    const res = await shopifyRequest(url);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Shopify API error: ${res.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await res.json();
    allOrders.push(...(data.orders || []));

    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  console.log(`Fetched ${allOrders.length} total orders across ${pageCount} page(s)`);
  console.log('Pagination completed');

  return allOrders;
}

async function fetchPaginatedResource(resource, query) {
  let url = `${buildShopifyApiUrl(`${resource}.json`)}?${query}`;
  const results = [];
  let pageCount = 0;

  while (url) {
    pageCount++;
    const res = await shopifyRequest(url);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Shopify API error: ${res.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await res.json();
    const items = data[resource] || [];
    results.push(...items);

    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  console.log(`Fetched ${results.length} total ${resource} across ${pageCount} page(s)`);
  console.log('Pagination completed');

  return results;
}

// Background Analytics Computation Functions
async function computeCustomerLtvByChannel(orders, days) {
  const sortedOrders = orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const customers = new Map();

  for (const order of sortedOrders) {
    const customerKey = getCustomerKey(order.customer);
    if (!customerKey) {
      continue;
    }

    const revenue = Number.parseFloat(order.total_price || 0);
    const channel = normalizeChannel(order.source_name);

    if (!customers.has(customerKey)) {
      customers.set(customerKey, {
        firstChannel: channel,
        totalOrders: 0,
        totalRevenue: 0
      });
    }

    const customerStats = customers.get(customerKey);
    customerStats.totalOrders += 1;
    customerStats.totalRevenue += revenue;
  }

  const byChannel = {
    app: { customers: 0, total_revenue: 0, total_orders: 0, avg_ltv: 0, avg_orders: 0 },
    web: { customers: 0, total_revenue: 0, total_orders: 0, avg_ltv: 0, avg_orders: 0 },
    other: { customers: 0, total_revenue: 0, total_orders: 0, avg_ltv: 0, avg_orders: 0 }
  };

  for (const stats of customers.values()) {
    const channelStats = byChannel[stats.firstChannel];
    channelStats.customers += 1;
    channelStats.total_revenue += stats.totalRevenue;
    channelStats.total_orders += stats.totalOrders;
  }

  for (const channel of Object.keys(byChannel)) {
    const stats = byChannel[channel];
    stats.total_revenue = roundCurrency(stats.total_revenue);
    stats.avg_ltv = stats.customers ? roundCurrency(stats.total_revenue / stats.customers) : 0;
    stats.avg_orders = stats.customers ? roundCurrency(stats.total_orders / stats.customers) : 0;
  }

  return {
    period_days: days,
    by_channel: byChannel
  };
}

async function computeWebToAppCustomers(orders, days) {
  const sortedOrders = orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const customers = new Map();

  for (const order of sortedOrders) {
    const customerKey = getCustomerKey(order.customer);
    if (!customerKey) {
      continue;
    }

    const channel = normalizeChannel(order.source_name);

    if (!customers.has(customerKey)) {
      customers.set(customerKey, {
        firstChannel: channel,
        channels: new Set([channel])
      });
      continue;
    }

    customers.get(customerKey).channels.add(channel);
  }

  let webFirstCustomers = 0;
  let webThenApp = 0;

  for (const customer of customers.values()) {
    if (customer.firstChannel !== 'web') {
      continue;
    }

    webFirstCustomers += 1;

    if (customer.channels.has('app')) {
      webThenApp += 1;
    }
  }

  const rate = webFirstCustomers ? roundCurrency((webThenApp / webFirstCustomers) * 100) : 0;

  return {
    period_days: days,
    web_first_customers: webFirstCustomers,
    web_then_app: webThenApp,
    web_to_app_rate_pct: rate
  };
}

async function computeAbandonedCheckouts(checkouts, days) {
  const productStats = new Map();
  let totalValue = 0;

  for (const checkout of checkouts) {
    const checkoutValue = Number.parseFloat(
      checkout.total_price || checkout.total_line_items_price || checkout.subtotal_price || 0
    );
    totalValue += checkoutValue;

    for (const item of checkout.line_items || []) {
      const title = item.title || 'Untitled product';
      const quantity = Number(item.quantity || 0);
      const lineValue = Number.parseFloat(item.price || 0) * quantity;

      if (!productStats.has(title)) {
        productStats.set(title, {
          title,
          count: 0,
          value: 0
        });
      }

      const product = productStats.get(title);
      product.count += quantity;
      product.value += lineValue;
    }
  }

  const topAbandonedProducts = [...productStats.values()]
    .map((product) => ({
      ...product,
      value: roundCurrency(product.value)
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, 20);

  return {
    period_days: days,
    total_abandoned: checkouts.length,
    total_value: roundCurrency(totalValue),
    top_abandoned_products: topAbandonedProducts
  };
}

async function computeDeliverySlots(orders, days) {
  const slotMap = new Map();

  for (const order of orders) {
    const tags = order.tags || '';
    const match = tags.match(DELIVERY_TAG_REGEX);

    if (!match) {
      continue;
    }

    const deliveryDate = match[1];

    if (!slotMap.has(deliveryDate)) {
      slotMap.set(deliveryDate, {
        date: deliveryDate,
        orders: 0,
        revenue: 0
      });
    }

    const slot = slotMap.get(deliveryDate);
    slot.orders += 1;
    slot.revenue += Number.parseFloat(order.total_price || 0);
  }

  const slots = [...slotMap.values()]
    .map((slot) => ({
      ...slot,
      revenue: roundCurrency(slot.revenue)
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    period_days: days,
    slots
  };
}

// Background Worker: Refresh All Analytics
async function refreshAllAnalytics() {
  if (storeMetadata.isRefreshing) {
    console.log('⚠️  Refresh already in progress, skipping...');
    return;
  }

  storeMetadata.isRefreshing = true;
  storeMetadata.refreshCount += 1;
  
  console.log('');
  console.log('='.repeat(60));
  console.log(`🔄 Analytics refresh started (refresh #${storeMetadata.refreshCount})`);
  console.log('='.repeat(60));

  try {
    // Process each analytics configuration
    for (const config of ANALYTICS_CONFIGS) {
      try {
        const key = getStoreKey(config.type, config.days);
        
        if (config.type === 'ltv') {
          console.log(`📊 Computing Customer LTV (${config.days} days)...`);
          const orders = await fetchAllOrders(getSinceIso(config.days));
          const result = await computeCustomerLtvByChannel(orders, config.days);
          setInStore(key, result);
        } 
        else if (config.type === 'web') {
          console.log(`📊 Computing Web-to-App conversion (${config.days} days)...`);
          const orders = await fetchAllOrders(getSinceIso(config.days));
          const result = await computeWebToAppCustomers(orders, config.days);
          setInStore(key, result);
        }
        else if (config.type === 'checkout') {
          console.log(`📊 Computing Abandoned Checkouts (${config.days} days)...`);
          const query = `created_at_min=${encodeURIComponent(getSinceIso(config.days))}&limit=250`;
          const checkouts = await fetchPaginatedResource('checkouts', query);
          const result = await computeAbandonedCheckouts(checkouts, config.days);
          setInStore(key, result);
        }
        else if (config.type === 'delivery') {
          console.log(`📊 Computing Delivery Slots (${config.days} days)...`);
          const query = `created_at_min=${encodeURIComponent(getSinceIso(config.days))}&status=any&fulfillment_status=on_hold&limit=250&fields=id,created_at,total_price,tags`;
          const orders = await fetchPaginatedResource('orders', query);
          const result = await computeDeliverySlots(orders, config.days);
          setInStore(key, result);
        }
      } catch (error) {
        console.error(`❌ Error computing ${config.type}:${config.days}:`, error.message);
        storeMetadata.errors.push({
          config,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    storeMetadata.lastUpdated = new Date().toISOString();
    console.log('');
    console.log('✅ Analytics refresh complete!');
    console.log(`📅 Last updated: ${storeMetadata.lastUpdated}`);
    console.log(`📦 Store size: ${analyticsStore.size} entries`);
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ Fatal error during analytics refresh:', error);
    storeMetadata.errors.push({
      type: 'fatal',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    storeMetadata.isRefreshing = false;
  }
}

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    shop: process.env.SHOPIFY_SHOP ? getShopDomain() : null,
    analytics_contract: {
      allowed_windows: ALLOWED_WINDOWS,
      total_configurations: ANALYTICS_CONFIGS.length
    },
    analytics_store: {
      last_updated: storeMetadata.lastUpdated,
      entries: analyticsStore.size,
      refresh_count: storeMetadata.refreshCount,
      is_refreshing: storeMetadata.isRefreshing
    }
  });
});

app.get('/customer-ltv-by-channel', async (req, res) => {
  try {
    // Validate time window contract
    const validation = validateTimeWindow(req.query.days || 365);
    
    if (!validation.valid) {
      console.log(`[ANALYTICS] Request received: ltv (INVALID: ${req.query.days})`);
      return res.status(400).json({
        error: validation.error,
        allowed_windows: validation.allowed,
        message: `Please use one of the allowed time windows: ${validation.allowed.join(', ')} days`
      });
    }
    
    const days = validation.days;
    const storeKey = getStoreKey('ltv', days);
    
    console.log(`[ANALYTICS] Request received: ${storeKey}`);
    
    // Get precomputed data from store
    const data = getFromStore(storeKey);
    
    if (data) {
      return res.json(data);
    }
    
    // Fallback: data is being computed (should only happen during startup)
    return res.status(202).json({
      status: 'computing',
      key: storeKey,
      message: `Analytics for ${days} days are being computed. This usually takes 30-60 seconds on first startup.`,
      retry_after_seconds: 5,
      last_updated: storeMetadata.lastUpdated
    });
  } catch (error) {
    console.error('[ANALYTICS] Error in /customer-ltv-by-channel:', error);
    sendError(res, error);
  }
});

app.get('/web-to-app-customers', async (req, res) => {
  try {
    // Validate time window contract
    const validation = validateTimeWindow(req.query.days || 365);
    
    if (!validation.valid) {
      console.log(`[ANALYTICS] Request received: web (INVALID: ${req.query.days})`);
      return res.status(400).json({
        error: validation.error,
        allowed_windows: validation.allowed,
        message: `Please use one of the allowed time windows: ${validation.allowed.join(', ')} days`
      });
    }
    
    const days = validation.days;
    const storeKey = getStoreKey('web', days);
    
    console.log(`[ANALYTICS] Request received: ${storeKey}`);
    
    // Get precomputed data from store
    const data = getFromStore(storeKey);
    
    if (data) {
      return res.json(data);
    }
    
    // Fallback: data is being computed
    return res.status(202).json({
      status: 'computing',
      key: storeKey,
      message: `Analytics for ${days} days are being computed. This usually takes 30-60 seconds on first startup.`,
      retry_after_seconds: 5,
      last_updated: storeMetadata.lastUpdated
    });
  } catch (error) {
    console.error('[ANALYTICS] Error in /web-to-app-customers:', error);
    sendError(res, error);
  }
});

app.get('/abandoned-checkouts', async (req, res) => {
  try {
    // Validate time window contract
    const validation = validateTimeWindow(req.query.days || 30);
    
    if (!validation.valid) {
      console.log(`[ANALYTICS] Request received: checkout (INVALID: ${req.query.days})`);
      return res.status(400).json({
        error: validation.error,
        allowed_windows: validation.allowed,
        message: `Please use one of the allowed time windows: ${validation.allowed.join(', ')} days`
      });
    }
    
    const days = validation.days;
    const storeKey = getStoreKey('checkout', days);
    
    console.log(`[ANALYTICS] Request received: ${storeKey}`);
    
    // Get precomputed data from store
    const data = getFromStore(storeKey);
    
    if (data) {
      return res.json(data);
    }
    
    // Fallback: data is being computed
    return res.status(202).json({
      status: 'computing',
      key: storeKey,
      message: `Analytics for ${days} days are being computed. This usually takes 30-60 seconds on first startup.`,
      retry_after_seconds: 5,
      last_updated: storeMetadata.lastUpdated
    });
  } catch (error) {
    console.error('[ANALYTICS] Error in /abandoned-checkouts:', error);
    sendError(res, error);
  }
});

app.get('/delivery-slots', async (req, res) => {
  try {
    // Validate time window contract
    const validation = validateTimeWindow(req.query.days || 30);
    
    if (!validation.valid) {
      console.log(`[ANALYTICS] Request received: delivery (INVALID: ${req.query.days})`);
      return res.status(400).json({
        error: validation.error,
        allowed_windows: validation.allowed,
        message: `Please use one of the allowed time windows: ${validation.allowed.join(', ')} days`
      });
    }
    
    const days = validation.days;
    const storeKey = getStoreKey('delivery', days);
    
    console.log(`[ANALYTICS] Request received: ${storeKey}`);
    
    // Get precomputed data from store
    const data = getFromStore(storeKey);
    
    if (data) {
      return res.json(data);
    }
    
    // Fallback: data is being computed
    return res.status(202).json({
      status: 'computing',
      key: storeKey,
      message: `Analytics for ${days} days are being computed. This usually takes 30-60 seconds on first startup.`,
      retry_after_seconds: 5,
      last_updated: storeMetadata.lastUpdated
    });
  } catch (error) {
    console.error('[ANALYTICS] Error in /delivery-slots:', error);
    sendError(res, error);
  }
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  sendError(res, error);
});

// Server startup with analytics warm-up
async function startServer() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🚀 Starting Shopify Analytics Proxy Server');
  console.log('═'.repeat(60));
  console.log('');

  // Initial analytics warm-up
  console.log('🔥 Running initial analytics warm-up...');
  await refreshAllAnalytics();

  // Start background worker
  console.log('⏰ Starting background analytics refresh worker...');
  console.log(`📅 Refresh interval: ${REFRESH_INTERVAL / 1000 / 60} minutes`);
  setInterval(refreshAllAnalytics, REFRESH_INTERVAL);

  // Start Express server
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🏪 Shop: ${getShopDomain()}`);
    console.log(`📊 Analytics store: ${analyticsStore.size} entries`);
    console.log(`🔄 Background refresh: Every ${REFRESH_INTERVAL / 1000 / 60} minutes`);
    console.log('═'.repeat(60));
    console.log('');
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Fatal error during server startup:', error);
  process.exit(1);
});
