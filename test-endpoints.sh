#!/bin/bash
# Phase 1 - Endpoint Verification Script
# Usage: ./test-endpoints.sh <your-railway-url>
# Example: ./test-endpoints.sh https://your-app.railway.app

if [ -z "$1" ]; then
    echo "Usage: ./test-endpoints.sh <railway-url>"
    echo "Example: ./test-endpoints.sh https://your-app.railway.app"
    exit 1
fi

BASE_URL="${1%/}"  # Remove trailing slash if present

echo ""
echo "========================================"
echo "Phase 1 - Endpoint Verification"
echo "========================================"
echo ""

# Test 1: Health Check
echo "[1/5] Testing Health Endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health Check: SUCCESS"
    echo "   Response: $BODY"
    echo ""
else
    echo "❌ Health Check: FAILED (HTTP $HTTP_CODE)"
    echo ""
fi

# Test 2: Customer LTV by Channel
echo "[2/5] Testing Customer LTV by Channel (365 days)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/customer-ltv-by-channel?days=365")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Customer LTV: SUCCESS"
    echo "   Response preview: ${BODY:0:100}..."
    echo ""
else
    echo "❌ Customer LTV: FAILED (HTTP $HTTP_CODE)"
    echo ""
fi

# Test 3: Web to App Customers
echo "[3/5] Testing Web-to-App Customers (365 days)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/web-to-app-customers?days=365")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Web-to-App: SUCCESS"
    echo "   Response: $BODY"
    echo ""
else
    echo "❌ Web-to-App: FAILED (HTTP $HTTP_CODE)"
    echo ""
fi

# Test 4: Abandoned Checkouts
echo "[4/5] Testing Abandoned Checkouts (7 days)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/abandoned-checkouts?days=7")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Abandoned Checkouts: SUCCESS"
    echo "   Response preview: ${BODY:0:100}..."
    echo ""
else
    echo "❌ Abandoned Checkouts: FAILED (HTTP $HTTP_CODE)"
    echo ""
fi

# Test 5: Delivery Slots (NEWLY FIXED)
echo "[5/5] Testing Delivery Slots..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/delivery-slots")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Delivery Slots: SUCCESS"
    echo "   Response preview: ${BODY:0:100}..."
    echo ""
else
    echo "❌ Delivery Slots: FAILED (HTTP $HTTP_CODE)"
    echo ""
fi

echo "========================================"
echo "Verification Complete!"
echo "========================================"
echo ""

echo "📋 Next Steps:"
echo "1. Check Railway logs for pagination messages:"
echo "   - Look for: 'Fetched X total orders across Y page(s)'"
echo "   - Look for: 'Pagination completed'"
echo "2. If Y > 1, pagination is working across multiple pages! 🎉"
echo ""
echo "🔗 Railway Dashboard: https://railway.app/"
echo ""
