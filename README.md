# 🛍️ Shopify Proxy API

A Node.js Express API that provides analytics and insights from Shopify store data. Production-ready for deployment on Railway, Heroku, or similar platforms.

## 🎯 Purpose

This API exposes Shopify store data for integration with external tools like Claude AI and Make.com automation platforms. It provides endpoints for customer analytics, abandoned cart tracking, and delivery management.

## 🚀 Quick Start

### Prerequisites
- Node.js installed
- Shopify Admin API access token

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your Shopify credentials:
```env
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_TOKEN=your_admin_api_token
PORT=3001
```

### 3. Start Server
```bash
npm start
```

Server will run on `http://localhost:3001`

## 📡 API Endpoints

### Health Check
```
GET /
```
Returns server status and configured shop.

**Response:**
```json
{
  "status": "ok",
  "shop": "your-store.myshopify.com"
}
```

### Customer LTV by Channel
```
GET /customer-ltv-by-channel?days=365
```
Analyzes customer lifetime value segmented by acquisition channel (app, web, other).

**Parameters:**
- `days` (optional): Number of days to analyze (default: 365)

**Response:**
```json
{
  "period_days": 365,
  "by_channel": {
    "app": {
      "customers": 150,
      "total_revenue": 45000.00,
      "total_orders": 450,
      "avg_ltv": 300.00,
      "avg_orders": 3.00
    },
    "web": { ... },
    "other": { ... }
  }
}
```

### Web to App Conversion
```
GET /web-to-app-customers?days=365
```
Tracks customers who started on web and later purchased via mobile app.

**Parameters:**
- `days` (optional): Number of days to analyze (default: 365)

**Response:**
```json
{
  "web_first_customers": 500,
  "web_then_app": 75,
  "web_to_app_rate_pct": 15.00
}
```

### Abandoned Checkouts
```
GET /abandoned-checkouts?days=14
```
Analyzes abandoned checkouts and identifies most abandoned products.

**Parameters:**
- `days` (optional): Number of days to analyze (default: 14)

**Response:**
```json
{
  "total_abandoned": 45,
  "total_value": 12500.00,
  "top_abandoned_products": [
    {
      "title": "Product Name",
      "count": 12,
      "value": 3600.00
    }
  ]
}
```

### Delivery Slots
```
GET /delivery-slots
```
Lists upcoming delivery slots with order counts and revenue.

**Response:**
```json
{
  "slots": [
    {
      "date": "15 May 2026",
      "orders": 23,
      "revenue": 4500.00
    }
  ]
}
```

## 🚂 Production Deployment

See **RAILWAY-DEPLOYMENT.md** for complete Railway deployment instructions.

### Quick Deploy to Railway:
1. Push code to GitHub
2. Connect repository to Railway
3. Add environment variables (`SHOPIFY_SHOP`, `SHOPIFY_TOKEN`)
4. Deploy automatically

Railway will provide a public HTTPS URL for your API.

## 🧪 Testing

### Local Testing
```bash
# Health check
curl http://localhost:3001/

# Customer LTV
curl http://localhost:3001/customer-ltv-by-channel?days=30

# Abandoned checkouts
curl http://localhost:3001/abandoned-checkouts?days=7
```

## 🔧 Configuration

### Environment Variables
- `SHOPIFY_SHOP` - Your Shopify store domain (e.g., store.myshopify.com)
- `SHOPIFY_TOKEN` - Shopify Admin API access token
- `PORT` - Server port (default: 3001, Railway sets automatically)

### Shopify API Permissions Required
Your access token needs these permissions:
- `read_orders` - For order data
- `read_customers` - For customer analytics
- `read_checkouts` - For abandoned cart data

## 📚 Documentation

- **RAILWAY-DEPLOYMENT.md** - Complete deployment guide for Railway
- **ARCHITECTURE.txt** - System architecture documentation
- **NEXT-STEPS.txt** - Future enhancements and roadmap

## 🔒 Security Notes

- ✅ CORS enabled for all origins
- ✅ Shopify token stored in .env (not exposed)
- ✅ Environment variables excluded from git
- ✅ Production-ready error handling
- ⚠️ Consider adding API authentication for production use

## 🐛 Troubleshooting

### Server Issues
```bash
# Check if server is running
curl http://localhost:3001

# View server logs
npm start
```

### Shopify API Errors
- **401 Unauthorized**: Verify your Shopify token and permissions
- **429 Rate Limited**: API automatically retries with exponential backoff
- **500 Server Error**: Check server logs for details

## 📊 Technical Details

### Stack
- **Runtime:** Node.js
- **Framework:** Express.js 5.2.1
- **HTTP Client:** node-fetch 3.3.2
- **Environment:** dotenv 17.4.2
- **CORS:** cors 2.8.6

### Features
- ✅ Automatic rate limit handling (429 retry)
- ✅ Pagination support for large datasets
- ✅ Request logging with timestamps
- ✅ Error handling and validation
- ✅ CORS enabled for external access
- ✅ Dynamic port binding for cloud deployment

### API Version
Uses Shopify Admin API version: **2024-01**

## 🤝 Integration Examples

### Claude AI
```
Base URL: https://your-app.up.railway.app

Example prompt:
"Analyze customer LTV by channel for the last 30 days using the API at https://your-app.up.railway.app/customer-ltv-by-channel?days=30"
```

### Make.com
1. Add HTTP module
2. Set URL: `https://your-app.up.railway.app/customer-ltv-by-channel?days=30`
3. Method: GET
4. Parse JSON response

### Postman
1. Import collection or create new request
2. Set base URL: `https://your-app.up.railway.app`
3. Test endpoints with different parameters

## 📈 Performance

- **Rate Limiting:** Automatic retry with exponential backoff
- **Pagination:** Handles large datasets (250 items per page)
- **Caching:** None (real-time data)
- **Scalability:** Ready for cloud deployment with auto-scaling

## 🎯 Use Cases

1. **Customer Analytics**
   - Track customer lifetime value by acquisition channel
   - Identify high-value customer segments
   - Measure web-to-app conversion rates

2. **Cart Recovery**
   - Identify most abandoned products
   - Calculate abandoned cart value
   - Target recovery campaigns

3. **Operations**
   - Manage delivery schedules
   - Track orders by delivery date
   - Optimize fulfillment planning

4. **Automation**
   - Integrate with Make.com workflows
   - Feed data to AI assistants (Claude)
   - Build custom dashboards

## 📝 License

ISC

## 🔗 Links

- [Shopify Admin API Docs](https://shopify.dev/docs/api/admin-rest)
- [Railway Documentation](https://docs.railway.app/)
- [Express.js Guide](https://expressjs.com/)

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** May 19, 2026
