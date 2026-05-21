# ⚡ Railway Quick Start - 5 Minutes to Deploy

## Step 1: Push to GitHub (2 minutes)

```bash
git init
git add .
git commit -m "Initial commit - Railway ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: Deploy to Railway (2 minutes)

1. Go to **https://railway.app/**
2. Click **"Login"** → Sign in with GitHub
3. Click **"New Project"**
4. Click **"Deploy from GitHub repo"**
5. Select your repository
6. Railway auto-detects Node.js and deploys ✅

## Step 3: Add Environment Variables (1 minute)

In Railway dashboard:
1. Click your project
2. Click **"Variables"** tab
3. Click **"+ New Variable"**
4. Add these two variables:

```
SHOPIFY_SHOP = your-store.myshopify.com
SHOPIFY_TOKEN = shpat_xxxxxxxxxxxxx
```

**Important:** Do NOT add `PORT` - Railway sets it automatically!

## Step 4: Test Your API (30 seconds)

Railway provides a URL like: `https://your-app.up.railway.app`

Test it:
```bash
curl https://your-app.up.railway.app/
```

Expected response:
```json
{"status":"ok","shop":"your-store.myshopify.com"}
```

## 🎉 Done!

Your API is now live at: `https://your-app.up.railway.app`

### Available Endpoints:
- `GET /` - Health check
- `GET /customer-ltv-by-channel?days=365`
- `GET /web-to-app-customers?days=365`
- `GET /abandoned-checkouts?days=7`
- `GET /delivery-slots`

### Next Steps:
- Update Claude/Make.com with your new Railway URL
- Set up custom domain (optional)
- Monitor logs in Railway dashboard

---

**Need help?** See `RAILWAY-DEPLOYMENT.md` for detailed instructions.
