# Phase 1 - Endpoint Verification Script
# Usage: .\test-endpoints.ps1 <your-railway-url>
# Example: .\test-endpoints.ps1 https://your-app.railway.app

param(
    [Parameter(Mandatory=$true)]
    [string]$BaseUrl
)

# Remove trailing slash if present
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Phase 1 - Endpoint Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "[1/5] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/" -Method Get -TimeoutSec 30
    Write-Host "✅ Health Check: SUCCESS" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host "   Shop: $($response.shop)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Test 2: Customer LTV by Channel
Write-Host "[2/5] Testing Customer LTV by Channel (365 days)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/customer-ltv-by-channel?days=365" -Method Get -TimeoutSec 30
    Write-Host "✅ Customer LTV: SUCCESS" -ForegroundColor Green
    Write-Host "   Period: $($response.period_days) days" -ForegroundColor Gray
    Write-Host "   App Customers: $($response.by_channel.app.customers)" -ForegroundColor Gray
    Write-Host "   Web Customers: $($response.by_channel.web.customers)" -ForegroundColor Gray
    Write-Host "   Total Revenue: `$$($response.by_channel.app.total_revenue + $response.by_channel.web.total_revenue)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Customer LTV: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Test 3: Web to App Customers
Write-Host "[3/5] Testing Web-to-App Customers (365 days)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/web-to-app-customers?days=365" -Method Get -TimeoutSec 30
    Write-Host "✅ Web-to-App: SUCCESS" -ForegroundColor Green
    Write-Host "   Web First Customers: $($response.web_first_customers)" -ForegroundColor Gray
    Write-Host "   Converted to App: $($response.web_then_app)" -ForegroundColor Gray
    Write-Host "   Conversion Rate: $($response.web_to_app_rate_pct)%`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Web-to-App: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Test 4: Abandoned Checkouts
Write-Host "[4/5] Testing Abandoned Checkouts (7 days)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/abandoned-checkouts?days=7" -Method Get -TimeoutSec 30
    Write-Host "✅ Abandoned Checkouts: SUCCESS" -ForegroundColor Green
    Write-Host "   Total Abandoned: $($response.total_abandoned)" -ForegroundColor Gray
    Write-Host "   Total Value: `$$($response.total_value)" -ForegroundColor Gray
    Write-Host "   Top Products: $($response.top_abandoned_products.Count)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Abandoned Checkouts: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Test 5: Delivery Slots (NEWLY FIXED)
Write-Host "[5/5] Testing Delivery Slots..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/delivery-slots" -Method Get -TimeoutSec 30
    Write-Host "✅ Delivery Slots: SUCCESS" -ForegroundColor Green
    Write-Host "   Total Slots: $($response.slots.Count)" -ForegroundColor Gray
    if ($response.slots.Count -gt 0) {
        $totalOrders = ($response.slots | Measure-Object -Property orders -Sum).Sum
        $totalRevenue = ($response.slots | Measure-Object -Property revenue -Sum).Sum
        Write-Host "   Total Orders: $totalOrders" -ForegroundColor Gray
        Write-Host "   Total Revenue: `$$totalRevenue" -ForegroundColor Gray
    }
    Write-Host "" -ForegroundColor Gray
} catch {
    Write-Host "❌ Delivery Slots: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)`n" -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check Railway logs for pagination messages:" -ForegroundColor White
Write-Host "   - Look for: 'Fetched X total orders across Y page(s)'" -ForegroundColor Gray
Write-Host "   - Look for: 'Pagination completed'" -ForegroundColor Gray
Write-Host "2. If Y > 1, pagination is working across multiple pages! 🎉`n" -ForegroundColor White

Write-Host "🔗 Railway Dashboard: https://railway.app/`n" -ForegroundColor Cyan
