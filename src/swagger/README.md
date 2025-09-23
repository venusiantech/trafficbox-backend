# TrafficBox API Documentation

This directory contains comprehensive Swagger/OpenAPI documentation for all TrafficBox API endpoints.

## Files Structure

```
swagger/
├── swagger.js              # Main Swagger configuration and schemas
└── paths/
    ├── index.js            # Path loader
    ├── auth.js             # Authentication endpoints
    ├── campaigns.js        # Campaign management endpoints
    ├── admin.js            # Admin-only endpoints
    └── misc.js             # Account, profile, and website endpoints
```

## Access Documentation

Once the server is running, access the interactive Swagger UI at:

- **Local Development**: http://localhost:5000/api-docs
- **Production**: https://your-domain.com/api-docs

## API Overview

### Authentication Endpoints (`/api/auth`)

- **POST** `/api/auth/register` - Register new user
- **POST** `/api/auth/register-admin` - Register admin user (testing)
- **POST** `/api/auth/login` - Login (users and admins)

### Campaign Management (`/api/campaigns`)

- **POST** `/api/campaigns` - Create campaign
- **GET** `/api/campaigns/:id` - Get campaign details
- **PUT** `/api/campaigns/:id` - Update campaign
- **DELETE** `/api/campaigns/:id` - Archive campaign (soft delete)
- **POST** `/api/campaigns/:id/pause` - Pause campaign
- **POST** `/api/campaigns/:id/resume` - Resume campaign
- **POST** `/api/campaigns/:id/restore` - Restore archived campaign
- **GET** `/api/campaigns/archived` - Get archived campaigns
- **GET** `/api/campaigns/user/stats` - Get user stats
- **POST** `/api/campaigns/user/:userId/add-credits` - Add credits (admin)

### Admin Panel (`/api/admin`)

- **GET** `/api/admin/dashboard` - Admin dashboard overview
- **GET** `/api/admin/users` - Get all users (paginated)
- **GET** `/api/admin/campaigns` - Get all campaigns (paginated)
- **GET** `/api/admin/users/:userId` - Get user details
- **PUT** `/api/admin/users/:userId/credits` - Update user credits
- **POST** `/api/admin/campaigns/:campaignId/:action` - Force pause/resume
- **DELETE** `/api/admin/campaigns/:campaignId` - Admin delete campaign
- **GET** `/api/admin/analytics` - System analytics
- **GET** `/api/admin/search` - Search users and campaigns

### Archive Management (`/api/admin/archives`)

- **GET** `/api/admin/archives/stats` - Archive statistics
- **POST** `/api/admin/archives/cleanup` - Manual cleanup job
- **GET** `/api/admin/archives/campaigns` - All archived campaigns

### Account & Profile (`/api/account`, `/api/me`)

- **GET** `/api/account` - Get account info
- **PUT** `/api/account` - Update account
- **GET** `/api/me` - Get current user profile

### Websites (`/api/websites`)

- **GET** `/api/websites` - Get user websites
- **POST** `/api/websites` - Add new website

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

1. **Register**: POST `/api/auth/register` or `/api/auth/register-admin`
2. **Login**: POST `/api/auth/login`
3. **Use Token**: Include in Authorization header for all subsequent requests

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

## Key Features

### Soft Delete System

- Campaigns are archived instead of permanently deleted
- 7-day grace period for restoration
- Automated cleanup jobs mark campaigns eligible for permanent deletion
- Admin oversight of archive system

### Credit/Hits System

- Users get 5000 credits = 1666 available hits by default
- Hits are deducted when creating campaigns
- Admin can manage user credits and hits

### Vendor Integration

- **SparkTraffic**: Project creation and speed control (0=pause, 200=resume)
- **9Hits**: Campaign management with state control
- Dual vendor support with unified API interface

### Admin Features

- Complete system oversight
- User and campaign management
- Archive system monitoring
- Analytics and reporting
- Manual cleanup controls

## Response Formats

### Success Response

```json
{
  "ok": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "error": "Error message description"
}
```

## Testing the Delete Route

The soft-delete system works as follows:

1. **First DELETE**: Archives campaign, sets `is_archived: true`, pauses on vendor
2. **Grace Period**: 7 days to restore using POST `/restore`
3. **Cleanup Job**: Marks campaigns `delete_eligible: true` after 7 days
4. **Second DELETE**: Permanently deletes if `delete_eligible: true`

Test sequence:

```bash
# Create campaign
POST /api/campaigns

# Archive campaign (soft delete)
DELETE /api/campaigns/:id

# Check archived campaigns
GET /api/campaigns/archived

# Restore if needed
POST /api/campaigns/:id/restore

# Or wait 7 days and delete again for permanent deletion
```

## Environment Requirements

Ensure these environment variables are set:

- `JWT_SECRET` - JWT signing secret
- `MONGO_URI` - MongoDB connection string
- `SPARKTRAFFIC_API_KEY` - SparkTraffic API key
- `NINEHITS_API_KEY` - 9Hits API key

## Support

For API support or questions, refer to the interactive Swagger UI documentation at `/api-docs` when the server is running.
