# TrafficBox Backend API Documentation (v2.0.0)

This directory contains comprehensive Swagger/OpenAPI documentation for all TrafficBox Backend API endpoints with automated credit deduction and new geo format support.

## Recent Updates (v2.0.0)

### 🆕 Core Enhancements

- **New Geo Format**: Supports country/percent objects for precise traffic distribution
- **Automated Credit System**: Every 5-second credit deduction with comprehensive debugging
- **Clean API Responses**: Vendor implementation details hidden from end users
- **Migration System**: Seamless migration from old to new geo format
- **Enhanced Documentation**: Complete endpoint coverage with examples

### 🎯 New Geo Format

The API now supports precise traffic allocation with percentage-based geo targeting:

**New Format (Required for new campaigns):**

```json
{
  "geo": [
    { "country": "US", "percent": 0.34 },
    { "country": "AE", "percent": 0.33 },
    { "country": "IN", "percent": 0.33 }
  ]
}
```

**Legacy Format (Still supported for existing campaigns):**

```json
{
  "countries": ["US", "AE", "IN"]
}
```

### 📊 New Schemas Added

- **CleanCampaign**: User-friendly campaign response hiding vendor details
- **GeoFormat**: New country/percent object structure
- **UserStats**: Enhanced user statistics with credits and hits
- **CreditDebugInfo**: Comprehensive debug information for credit system

## Files Structure

```
swagger/
├── swagger.js              # Main Swagger configuration and schemas
└── paths/
    ├── index.js            # Path loader
    ├── auth.js             # Authentication endpoints
    ├── campaigns.js        # Campaign management endpoints (UPDATED)
    ├── admin.js            # Admin-only endpoints (UPDATED)
    └── misc.js             # Account, profile, and website endpoints
```

## 🆕 New Endpoints Added

### Campaign Management

- **POST** `/api/campaigns/{id}/modify` - Update campaigns with new geo format support
- **GET** `/api/campaigns/{id}/credit-debug` - Debug credit processing state
- **POST** `/api/campaigns/{id}/test-credits` - Test credit processing
- **POST** `/api/campaigns/{id}/toggle-credit-deduction` - Enable/disable auto deduction

### Admin Credit System

- **POST** `/api/campaigns/admin/process-all-credits` - Bulk credit processing
- **POST** `/api/campaigns/admin/migrate-geo-format` - Migrate to new geo format
- **GET** `/api/admin/credit-system/stats` - Credit system statistics
- **GET** `/api/admin/migration/geo-format/status` - Migration status

## Access Documentation

Once the server is running, access the interactive Swagger UI at:

- **Local Development**: http://localhost:5001/api-docs
- **Production**: https://your-domain.com/api-docs

## 🔧 Migration Guide

### For Existing Campaigns

Use the admin migration endpoint to convert campaigns from old format to new format:

```bash
# Check migration status
GET /api/admin/migration/geo-format/status

# Run migration (admin only)
POST /api/campaigns/admin/migrate-geo-format
{
  "dryRun": false,
  "batchSize": 100
}
```

### For New Campaigns

Always use the new geo format when creating campaigns:

```json
{
  "url": "https://example.com",
  "title": "My Campaign",
  "geo": [
    { "country": "US", "percent": 0.5 },
    { "country": "CA", "percent": 0.3 },
    { "country": "GB", "percent": 0.2 }
  ]
}
```

## 🔄 Automated Credit System

### How It Works

- **Every 5 seconds**: System checks all active campaigns for new hits
- **SparkTraffic Integration**: Fetches real-time hit statistics
- **Automatic Deduction**: 1 credit per new hit detected
- **User Protection**: Stops when user runs out of credits

### Monitoring & Debugging

```bash
# Debug specific campaign credit state
GET /api/campaigns/{id}/credit-debug

# Test credit processing for campaign
POST /api/campaigns/{id}/test-credits

# Toggle auto-deduction for campaign
POST /api/campaigns/{id}/toggle-credit-deduction

# Admin: Process all campaigns manually
POST /api/campaigns/admin/process-all-credits
```

## API Overview

### Authentication Endpoints (`/api/auth`)

- **POST** `/api/auth/register` - Register new user
- **POST** `/api/auth/register-admin` - Register admin user (testing)
- **POST** `/api/auth/login` - Login (users and admins)

### 🔥 Enhanced Campaign Management (`/api/campaigns`)

- **POST** `/api/campaigns` - Create campaign (supports new geo format)
- **GET** `/api/campaigns/:id` - Get campaign details with stats
- **POST** `/api/campaigns/:id/modify` - 🆕 Update with new geo format
- **DELETE** `/api/campaigns/:id` - Archive campaign (soft delete)
- **POST** `/api/campaigns/:id/pause` - Pause campaign
- **POST** `/api/campaigns/:id/resume` - Resume campaign
- **GET** `/api/campaigns/:id/stats` - Detailed campaign statistics
- **GET** `/api/campaigns/:id/credit-debug` - 🆕 Debug credit state
- **POST** `/api/campaigns/:id/test-credits` - 🆕 Test credit processing
- **POST** `/api/campaigns/:id/toggle-credit-deduction` - 🆕 Toggle auto-deduction
- **GET** `/api/campaigns/user/stats` - Get user stats
- **GET** `/api/campaigns/archived` - Get archived campaigns

### 🔧 Enhanced Admin Panel (`/api/admin`)

- **GET** `/api/admin/dashboard` - Admin dashboard overview
- **GET** `/api/admin/users` - Get all users (paginated)
- **GET** `/api/admin/campaigns` - Get all campaigns (paginated)
- **POST** `/api/campaigns/admin/process-all-credits` - 🆕 Bulk credit processing
- **POST** `/api/campaigns/admin/migrate-geo-format` - 🆕 Geo format migration
- **GET** `/api/admin/credit-system/stats` - 🆕 Credit system statistics
- **GET** `/api/admin/migration/geo-format/status` - 🆕 Migration status

### Archive Management (`/api/admin/archives`)

- **GET** `/api/admin/archives/stats` - Archive statistics
- **POST** `/api/admin/archives/cleanup` - Manual cleanup job
- **GET** `/api/admin/archives/campaigns` - All archived campaigns

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

### Test Credentials

**Regular User:**

```json
{
  "email": "azamtest3@gmail.com",
  "password": "test1234"
}
```

**Admin User:**

```json
{
  "email": "admin@test.com",
  "password": "admin123"
}
```

## 🔒 Backward Compatibility

- ✅ Legacy string array geo format still supported for existing campaigns
- ✅ Migration endpoint available for updating old campaigns
- ✅ Flexible validation supports both formats during transition
- ✅ Existing campaigns continue working without changes

## Key Features

### 🎯 Precise Traffic Targeting

- Country-specific percentage allocation
- Must total 100% (sum of percents = 1.0)
- Supports up to 11 countries per campaign

### 💰 Automated Credit System

- Real-time hit tracking and credit deduction
- User-friendly credit debugging tools
- Admin oversight and bulk processing
- Automatic campaign pausing when credits exhausted

### 🔄 Clean API Design

- Vendor details hidden from end users
- Consistent response formats across endpoints
- User-friendly status indicators
- Comprehensive error handling

### 🗑️ Soft Delete System

- 7-day grace period for campaign restoration
- Automated cleanup jobs
- Admin oversight capabilities

## Response Formats

### Success Response

```json
{
  "ok": true,
  "campaign": {
    /* CleanCampaign object */
  },
  "message": "Campaign created successfully",
  "userStats": {
    "hitsDeducted": 5,
    "remainingHits": 1661
  }
}
```

### Error Response

```json
{
  "error": "geo items must be objects with 'country' and 'percent' fields"
}
```

## Environment Requirements

```bash
JWT_SECRET=your_jwt_secret
MONGO_URI=mongodb://localhost:27017/trafficbox
SPARKTRAFFIC_API_KEY=your_sparktraffic_key
NODE_ENV=development
PORT=5001
```

## 🚀 Getting Started

1. **Start Server**: The API documentation will be available at `/api-docs`
2. **Register/Login**: Get your JWT token
3. **Create Campaign**: Use new geo format for optimal targeting
4. **Monitor Credits**: Use debug endpoints to track credit usage
5. **Manage Campaigns**: Pause, resume, modify as needed

## Support

For API support or questions, refer to the interactive Swagger UI documentation at `/api-docs` when the server is running, or check the comprehensive endpoint documentation in the `paths/` directory.
