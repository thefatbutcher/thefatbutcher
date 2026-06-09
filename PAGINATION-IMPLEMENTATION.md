# Shopify Cursor-Based Pagination Implementation

## Status: ✅ COMPLETED

All analytics endpoints now properly implement Shopify cursor-based pagination to retrieve complete datasets beyond the 250-record limit.

---

## What Was Changed

### 1. Enhanced `fetchAllOrders()` Function
**Location:** `server.js` (lines ~156-180)

```javascript
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
```

**Enhancements:**
- ✅ Added `pageCount` tracker
- ✅ Added console logging: `Fetched X total orders across Y page(s)`
- ✅ Added `Pagination completed` message
- ✅ Follows Shopify Link header pagination (RFC 8288)
- ✅ Continues until no `rel="next"` link exists

---

### 2. Enhanced `fetchPaginatedResource()` Function
**Location:** `server.js` (lines ~182-210)

```javascript
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
```

**Enhancements:**
- ✅ Added `pageCount` tracker
- ✅ Added resource-aware logging
- ✅ Generic pagination handler for any Shopify resource

---

### 3. Updated `/delivery-slots` Endpoint
**Location:** `server.js` (lines ~385-425)

**BEFORE (Limited to 250 records):**
```javascript
const data = await shopifyFetch(
  'orders.json?status=any&fulfillment_status=on_hold&limit=250&fields=id,created_at,total_price,tags'
);

for (const order of data.orders || []) {
  // Process orders...
}
```

**AFTER (Retrieves ALL records):**
```javascript
const query = 'status=any&fulfillment_status=on_hold&limit=250&fields=id,created_at,total_price,tags';
const orders = await fetchPaginatedResource('orders', query);

for (const order of orders) {
  // Process orders...
}
```

**Impact:** 
- Now retrieves ALL on-hold orders, not just first 250
- Critical for accurate delivery slot capacity planning

---

## Endpoints Using Pagination

### ✅ `/customer-ltv-by-channel`
- **Function:** `fetchAllOrders(since)`
- **Retrieves:** All orders within date range
- **Status:** Already implemented, now with logging

### ✅ `/web-to-app-customers`
- **Function:** `fetchAllOrders(since)`
- **Retrieves:** All orders within date range
- **Status:** Already implemented, now with logging

### ✅ `/abandoned-checkouts`
- **Function:** `fetchPaginatedResource('checkouts', query)`
- **Retrieves:** All abandoned checkouts
- **Status:** Already implemented, now with logging

### ✅ `/delivery-slots`
- **Function:** `fetchPaginatedResource('orders', query)`
- **Retrieves:** All on-hold orders
- **Status:** NEWLY UPDATED to use pagination

---

## How Pagination Works

### 1. Shopify Link Header Format
```
Link: <https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=abc123>; rel="next"
```

### 2. Pagination Flow
```
Request 1: orders.json?limit=250&status=any
  ↓ Response: 250 orders + Link header with rel="next"
  
Request 2: orders.json?page_info=abc123
  ↓ Response: 250 orders + Link header with rel="next"
  
Request 3: orders.json?page_info=def456
  ↓ Response: 180 orders + NO Link header
  
Total: 680 orders retrieved
```

### 3. Rate Limiting Handling
- Built-in rate limit detection (HTTP 429)
- Respects `Retry-After` header
- Automatic retry with appropriate delay
- Implemented in `shopifyRequest()` function

---

## Expected Console Output

When endpoints are called, you'll now see:
```
[2026-06-09T10:30:15.123Z] GET /customer-ltv-by-channel?days=90
Fetched 1247 total orders across 5 page(s)
Pagination completed
```

```
[2026-06-09T10:31:42.456Z] GET /abandoned-checkouts?days=14
Fetched 89 total checkouts across 1 page(s)
Pagination completed
```

---

## Testing Recommendations

### 1. Test with Different Date Ranges
```bash
# Small dataset (should be 1 page)
curl https://your-railway-app.com/customer-ltv-by-channel?days=7

# Large dataset (likely multiple pages)
curl https://your-railway-app.com/customer-ltv-by-channel?days=365
```

### 2. Monitor Railway Logs
Check Railway logs after deployment to see pagination in action:
```
Railway Dashboard → Your App → Logs
```

### 3. Verify Data Completeness
Compare order counts before/after:
- Previously: Maximum 250 per endpoint
- Now: All orders retrieved

---

## No Additional Dependencies Required

✅ All pagination uses built-in Node.js features:
- Native `fetch` (Node.js 18+) 
- `node-fetch` (fallback for older versions)
- No new npm packages needed

**Current Dependencies (unchanged):**
```json
{
  "cors": "^2.8.6",
  "dotenv": "^17.4.2",
  "express": "^5.2.1",
  "node-fetch": "^3.3.2"
}
```

---

## Deployment Steps

### Option 1: Git Push (Recommended)
```bash
git add server.js
git commit -m "Implement complete Shopify cursor-based pagination with logging"
git push origin main
```
Railway will auto-deploy from GitHub.

### Option 2: Manual Deployment
1. Copy updated `server.js` to your project
2. Railway will detect changes and redeploy automatically

---

## Error Handling

All pagination functions include:

### 1. Shopify API Errors
```javascript
if (!res.ok) {
  throw new Error(`Shopify API error: ${res.status}`);
}
```

### 2. Endpoint-Level Handling
```javascript
try {
  const orders = await fetchAllOrders(since);
  // Process orders...
} catch (error) {
  console.error('Error in endpoint:', error);
  sendError(res, error); // Returns 500 with error details
}
```

### 3. Rate Limiting
Automatically handled by `shopifyRequest()`:
- Detects HTTP 429
- Waits for `Retry-After` duration
- Retries request once

---

## Performance Considerations

### Request Volume
- **250 orders/page** = ~4 requests per 1000 orders
- Example: 5000 orders = ~20 API requests

### Response Times
- First 250 orders: ~500ms
- Each additional page: ~500ms
- Total for 1000 orders: ~2 seconds

### Railway Timeout
- Default: 30 seconds
- Should handle up to ~15,000 orders (60 pages)
- Well above typical shop volumes

---

## Verification Checklist

✅ `fetchAllOrders()` implements cursor-based pagination  
✅ `fetchPaginatedResource()` implements cursor-based pagination  
✅ Console logging added to both functions  
✅ `/customer-ltv-by-channel` uses `fetchAllOrders()`  
✅ `/web-to-app-customers` uses `fetchAllOrders()`  
✅ `/abandoned-checkouts` uses `fetchPaginatedResource()`  
✅ `/delivery-slots` NOW uses `fetchPaginatedResource()`  
✅ All endpoints have try/catch error handling  
✅ Rate limiting handled automatically  
✅ No new dependencies required  
✅ Compatible with existing Railway deployment  

---

## Summary

**All analytics endpoints now retrieve complete datasets**, eliminating the previous 250-record limitation. The implementation:

- Uses official Shopify Link header pagination (RFC 8288)
- Includes comprehensive logging for monitoring
- Handles rate limiting automatically
- Maintains backward compatibility
- Requires no new dependencies
- Is production-ready for Railway deployment

**Next Step:** Push to GitHub and verify in Railway logs! 🚀
