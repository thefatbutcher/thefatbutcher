# 🚂 Railway Deployment Guide

## ✅ Project Status
This project is **ready for Railway deployment**. All ngrok dependencies have been removed and the application is configured for production hosting.

---

## 📋 Pre-Deployment Checklist

- ✅ Server uses dynamic PORT from environment (`process.env.PORT`)
- ✅ Server binds to `0.0.0.0` (all interfaces)
- ✅ No hardcoded localhost URLs
- ✅ No ngrok dependencies
- ✅ `.gitignore` configured properly
- ✅ Environment variables documented
- ✅ Production-ready error handling
- ✅ CORS enabled for external access

---

## 🚀 Railway Deployment Steps

### Step 1: Push to GitHub (if not already done)

```bash
git init
git add .
git commit -m "Prepare for Railway deployment"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway:** https://railway.app/
2. **Sign in** with GitHub
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your repository**
6. Railway will automatically detect Node.js and deploy

### Step 3: Configure Environment Variables

In Railway dashboard, go to your project → **Variables** tab and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `SHOPIFY_SHOP` | `your-store.myshopify.com` | Your Shopify store domain |
| `SHOPIFY_TOKEN` | `shpat_xxxxx...` | Your Shopify Admin API token |
| `PORT` | *(leave empty)* | Railway sets this automatically |

**Important:** 
- Do NOT set `PORT` manually - Railway provides this automatically
- Keep your `SHOPIFY_TOKEN` secure and never commit it to git

### Step 4: Verify Deployment

After deployment completes:

1. Railway will provide a public URL like: `https://your-app.up.railway.app`
2. Test the health endpoint:
   ```bash
   curl https://your-app.up.railway.app/
   ```
3. Expected response:
   ```json
   {"status":"ok","shop":"your-store.myshopify.com"}
   ```

---

## 🔗 API Endpoints

Once deployed, your API will be available at: `https://your-app.up.railway.app`

### Available Endpoints:

#### 1. Health Check
```
GET /
```

#### 2. Customer LTV by Channel
```
GET /customer-ltv-by-channel?days=365
```
Returns customer lifetime value grouped by acquisition channel (app/web/other).

#### 3. Web to App Customers
```
GET /web-to-app-customers?days=365
```
Returns conversion rate of customers who started on web and later used the app.

#### 4. Abandoned Checkouts
```
GET /abandoned-checkouts?days=7
```
Returns abandoned checkout statistics and top abandoned products.

#### 5. Delivery Slots
```
GET /delivery-slots
```
Returns scheduled delivery slots from orders with delivery tags.

---

## 🔧 Local Development

To run locally:

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your credentials
# SHOPIFY_SHOP=your-store.myshopify.com
# SHOPIFY_TOKEN=shpat_xxxxx...
# PORT=3001

# Start server
npm start
```

Server will run on `http://localhost:3001`

---

## 📊 Monitoring & Logs

### View Logs in Railway:
1. Go to your project in Railway dashboard
2. Click on your service
3. Click **"Deployments"** tab
4. Click on the latest deployment
5. View real-time logs

### Health Monitoring:
- Use the `/` endpoint for health checks
- Railway provides automatic health monitoring
- Set up external monitoring (e.g., UptimeRobot) for production

---

## 🔒 Security Best Practices

✅ **Already Implemented:**
- Environment variables for sensitive data
- `.env` excluded from git
- CORS enabled for API access
- Proper error handling without exposing internals

⚠️ **Consider Adding:**
- Rate limiting for API endpoints
- API key authentication if needed
- Request logging for audit trails
- IP whitelisting if applicable

---

## 🐛 Troubleshooting

### Issue: "Application failed to respond"
**Solution:** Check Railway logs for errors. Ensure `SHOPIFY_SHOP` and `SHOPIFY_TOKEN` are set correctly.

### Issue: "Shopify API error"
**Solution:** Verify your `SHOPIFY_TOKEN` has the correct permissions:
- `read_orders`
- `read_customers`
- `read_checkouts`

### Issue: "CORS errors"
**Solution:** CORS is already enabled. If issues persist, check the request origin.

### Issue: Port binding errors
**Solution:** Ensure you're NOT setting `PORT` manually in Railway. Let Railway set it automatically.

---

## 📈 Scaling & Performance

Railway automatically handles:
- ✅ Auto-scaling based on traffic
- ✅ Load balancing
- ✅ SSL/HTTPS certificates
- ✅ CDN for static assets
- ✅ Zero-downtime deployments

For high-traffic scenarios:
- Consider implementing caching (Redis)
- Add database for storing computed results
- Implement request queuing for heavy operations

---

## 💰 Railway Pricing

**Starter Plan (Free):**
- $5 free credit per month
- Suitable for development and low-traffic APIs

**Developer Plan ($5/month):**
- $5 credit included
- Pay for usage beyond credit
- Suitable for production APIs

**Estimated Usage:**
- Low traffic (< 1000 requests/day): Free tier sufficient
- Medium traffic: ~$5-10/month
- High traffic: Scale as needed

---

## 🎯 Next Steps After Deployment

1. ✅ Test all API endpoints with production URL
2. ✅ Update any external integrations (Claude, Make.com) with new URL
3. ✅ Set up monitoring and alerts
4. ✅ Configure custom domain (optional)
5. ✅ Document API for team members
6. ✅ Set up CI/CD for automatic deployments

---

## 📞 Support

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Shopify API Docs:** https://shopify.dev/docs/api/admin-rest

---

**Last Updated:** May 19, 2026  
**Status:** ✅ Production Ready  
**Deployment Platform:** Railway
