# TrafficBox API Testing Script (PowerShell)
# Run this script to test all API endpoints quickly

$BASE_URL = "http://localhost:5000"
$AUTH_TOKEN = ""
$ADMIN_TOKEN = ""
$CAMPAIGN_ID = ""

Write-Host "🧪 TrafficBox API Testing Script" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Helper function to make API calls
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [string]$Token = $AUTH_TOKEN,
        [string]$ContentType = "application/json"
    )
    
    $headers = @{
        "Content-Type" = $ContentType
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    $params = @{
        Uri = "$BASE_URL$Endpoint"
        Method = $Method
        Headers = $headers
    }
    
    if ($Body) {
        $params["Body"] = $Body | ConvertTo-Json -Depth 10
    }
    
    try {
        $response = Invoke-RestMethod @params
        Write-Host "✅ $Method $Endpoint - Success" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ $Method $Endpoint - Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. AUTHENTICATION TESTS
Write-Host "`n🔐 Testing Authentication..." -ForegroundColor Yellow

# Register User
$registerUser = @{
    email = "testuser@example.com"
    password = "password123"
    firstName = "Test"
    lastName = "User"
    dob = "1990-01-01"
}
Invoke-ApiCall -Method "POST" -Endpoint "/api/auth/register" -Body $registerUser

# Login User
$loginUser = @{
    email = "azamtest3@gmail.com"
    password = "test1234"
}
$loginResponse = Invoke-ApiCall -Method "POST" -Endpoint "/api/auth/login" -Body $loginUser
if ($loginResponse) {
    $AUTH_TOKEN = $loginResponse.token
    Write-Host "🔑 Auth token saved!" -ForegroundColor Cyan
}

# Login Admin
$loginAdmin = @{
    email = "admin@test.com"
    password = "admin123"
}
$adminResponse = Invoke-ApiCall -Method "POST" -Endpoint "/api/auth/login" -Body $loginAdmin
if ($adminResponse) {
    $ADMIN_TOKEN = $adminResponse.token
    Write-Host "🔑 Admin token saved!" -ForegroundColor Cyan
}

# 2. CAMPAIGN MANAGEMENT TESTS
Write-Host "`n🎯 Testing Campaign Management..." -ForegroundColor Yellow

# Create Campaign
$campaignData = @{
    url = "trafficbox.com"
    title = "test-campaign"
    urls = @("https://trafficboxes.com")
    keywords = "test,traffic"
    referrers = @{
        mode = "basic"
        urls = @("https://ref.com")
    }
    languages = "en"
    bounce_rate = 0
    return_rate = 0
    click_outbound_events = 0
    form_submit_events = 0
    scroll_events = 0
    time_on_page = "2sec"
    desktop_rate = 2
    auto_renew = "true"
    geo_type = "countries"
    geo = @(
        @{country = "FR"; percent = 0.4},
        @{country = "DE"; percent = 0.6}
    )
    shortener = ""
    rss_feed = ""
    ga_id = ""
    size = "eco"
    speed = 200
}
$campaignResponse = Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns" -Body $campaignData
if ($campaignResponse -and $campaignResponse.campaign) {
    $CAMPAIGN_ID = $campaignResponse.campaign.id
    Write-Host "📋 Campaign ID saved: $CAMPAIGN_ID" -ForegroundColor Cyan
}

# Get All Campaigns
Invoke-ApiCall -Method "GET" -Endpoint "/api/campaigns?page=1&limit=10"

# Get Campaign by ID
if ($CAMPAIGN_ID) {
    Invoke-ApiCall -Method "GET" -Endpoint "/api/campaigns/$CAMPAIGN_ID"
}

# Get User Stats
Invoke-ApiCall -Method "GET" -Endpoint "/api/campaigns/user/stats"

# 3. CAMPAIGN OPERATIONS
if ($CAMPAIGN_ID) {
    Write-Host "`n⚙️ Testing Campaign Operations..." -ForegroundColor Yellow
    
    # Pause Campaign
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/$CAMPAIGN_ID/pause" -Body @{}
    
    # Resume Campaign
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/$CAMPAIGN_ID/resume" -Body @{}
    
    # Modify Campaign
    $modifyData = @{
        title = "Updated Campaign Title"
        speed = 150
        countries = @(
            @{country = "US"; percent = 0.6},
            @{country = "CA"; percent = 0.4}
        )
        traffic_type = "direct"
        keywords = "updated,keywords"
        time_on_page = "5sec"
        desktop_rate = 3
        bounce_rate = 10
    }
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/$CAMPAIGN_ID/modify" -Body $modifyData
    
    # Get Campaign Stats
    Invoke-ApiCall -Method "GET" -Endpoint "/api/campaigns/$CAMPAIGN_ID/stats?from=2024-01-01&to=2024-01-31"
}

# 4. CREDIT MANAGEMENT TESTS
if ($CAMPAIGN_ID) {
    Write-Host "`n🔧 Testing Credit Management..." -ForegroundColor Yellow
    
    # Debug Campaign Credits
    Invoke-ApiCall -Method "GET" -Endpoint "/api/campaigns/$CAMPAIGN_ID/credit-debug"
    
    # Test Credit Processing
    $creditTest = @{
        dryRun = $true
    }
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/$CAMPAIGN_ID/test-credits" -Body $creditTest
    
    # Toggle Credit Deduction
    $toggleCredit = @{
        enabled = $false
    }
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/$CAMPAIGN_ID/toggle-credit-deduction" -Body $toggleCredit
}

# 5. USER PROFILE TESTS
Write-Host "`n👤 Testing User Profile..." -ForegroundColor Yellow

# Get User Profile
Invoke-ApiCall -Method "GET" -Endpoint "/api/me"

# Get 9Hits Profile
Invoke-ApiCall -Method "GET" -Endpoint "/api/account"

# 6. WEBSITE MANAGEMENT TESTS
Write-Host "`n🌐 Testing Website Management..." -ForegroundColor Yellow

# Add Website
$websiteData = @{
    url = "https://mywebsite.com"
    title = "My Website"
    description = "Description of my website"
    metadata = @{
        category = "business"
        verified = $false
    }
}
Invoke-ApiCall -Method "POST" -Endpoint "/api/websites" -Body $websiteData

# Get All Websites
Invoke-ApiCall -Method "GET" -Endpoint "/api/websites"

# 7. ADMIN TESTS (if admin token available)
if ($ADMIN_TOKEN) {
    Write-Host "`n🔒 Testing Admin Endpoints..." -ForegroundColor Yellow
    
    # Admin Dashboard
    Invoke-ApiCall -Method "GET" -Endpoint "/api/admin/dashboard" -Token $ADMIN_TOKEN
    
    # Get All Users
    $usersResponse = Invoke-ApiCall -Method "GET" -Endpoint "/api/admin/users?page=1&limit=20" -Token $ADMIN_TOKEN
    
    # Get All Campaigns (Admin)
    Invoke-ApiCall -Method "GET" -Endpoint "/api/admin/campaigns?page=1&limit=20" -Token $ADMIN_TOKEN
    
    # System Analytics
    Invoke-ApiCall -Method "GET" -Endpoint "/api/admin/analytics?period=30d" -Token $ADMIN_TOKEN
    
    # Process All Campaign Credits
    Invoke-ApiCall -Method "POST" -Endpoint "/api/campaigns/admin/process-all-credits" -Body @{} -Token $ADMIN_TOKEN
    
    # Archive Statistics
    Invoke-ApiCall -Method "GET" -Endpoint "/api/admin/archives/stats" -Token $ADMIN_TOKEN
}

Write-Host "`n🎉 API Testing Completed!" -ForegroundColor Green
Write-Host "Check the output above for any errors (❌) or successes (✅)" -ForegroundColor Cyan

# Display tokens for manual testing
Write-Host "`n📋 Saved Tokens:" -ForegroundColor Yellow
Write-Host "Auth Token: $AUTH_TOKEN" -ForegroundColor Cyan
Write-Host "Admin Token: $ADMIN_TOKEN" -ForegroundColor Cyan
Write-Host "Campaign ID: $CAMPAIGN_ID" -ForegroundColor Cyan
