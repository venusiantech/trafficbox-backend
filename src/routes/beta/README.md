# Beta Routes - 9hits Integration

This folder contains all API routes for the **Beta Campaign System** which uses the **9hits** traffic vendor.

## 🏗️ Structure

```
beta/
├── index.js          # Main router - mounts all beta sub-routes
├── profile.js        # 9hits profile management
├── campaigns.js      # Beta campaign CRUD operations
├── dashboard.js      # Beta dashboard and analytics
└── traffic.js        # Beta traffic tracking and stats
```

## 🔗 API Endpoints

### Profile Routes (`/api/beta/profile`)

- `GET /api/beta/profile` - Get 9hits profile (funds, points, slots, membership)

### Campaign Routes (`/api/beta/campaigns`)

- `POST /api/beta/campaigns` - Create campaign _(coming soon)_
- `GET /api/beta/campaigns` - List all campaigns _(coming soon)_
- `GET /api/beta/campaigns/:id` - Get campaign details _(coming soon)_
- `PUT /api/beta/campaigns/:id` - Update campaign _(coming soon)_
- `DELETE /api/beta/campaigns/:id` - Delete campaign _(coming soon)_
- `POST /api/beta/campaigns/:id/pause` - Pause campaign _(coming soon)_
- `POST /api/beta/campaigns/:id/resume` - Resume campaign _(coming soon)_

### Dashboard Routes (`/api/beta/dashboard`)

- `GET /api/beta/dashboard` - Dashboard overview _(coming soon)_
- `GET /api/beta/dashboard/stats` - Statistics _(coming soon)_

### Traffic Routes (`/api/beta/traffic`)

- `GET /api/beta/traffic/:campaignId` - Get traffic stats _(coming soon)_
- `GET /api/beta/traffic/:campaignId/history` - Get traffic history _(coming soon)_

## 🔐 Authentication

All beta routes require JWT authentication via `requireRole()` middleware.

## 🔑 Configuration

Add to your `.env` file:

```env
NINE_HITS_API_KEY=your_9hits_api_key_here
```

## 🎯 Naming Convention

- **Alpha** = SparkTraffic integration
- **Beta** = 9hits integration

## 📝 Implementation Status

- ✅ Profile API - Implemented
- ⏳ Campaign Management - Waiting for API documentation
- ⏳ Dashboard - Waiting for API documentation
- ⏳ Traffic Stats - Waiting for API documentation

## 🔄 Next Steps

Please provide the 9hits API documentation for:

1. Campaign creation (`siteAdd` or equivalent)
2. Campaign update/modification
3. Campaign deletion
4. Campaign stats retrieval
5. Campaign pause/resume
6. Campaign listing

Each endpoint will be implemented in its respective controller file following the same patterns as the Alpha (SparkTraffic) routes.
