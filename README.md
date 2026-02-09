# TrafficBox Backend API

Tech stack: Node.js + Express + Mongoose

## 🎉 NEW: Beta Campaign System (9hits) Integration Started!

The **Beta Campaign System** using **9hits API** is now being integrated alongside the existing Alpha (SparkTraffic) system.

- **Alpha Campaigns** = SparkTraffic integration ✅
- **Beta Campaigns** = 9hits integration 🚧 (In Progress)

See **[BETA_INTEGRATION_STATUS.md](./BETA_INTEGRATION_STATUS.md)** for implementation details.

## 🎉 Stripe Subscription System Integrated!

A complete Stripe subscription management system with 5 pricing tiers has been integrated. New users automatically get a **Free tier** (no credit card required).

### 📋 Quick Links:

- **[Complete Integration Guide](./STRIPE_INTEGRATION_GUIDE.md)** - Full documentation (17 sections)
- **[API Quick Reference](./STRIPE_API_REFERENCE.md)** - cURL examples and endpoints
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Visual overview

### 🎯 Subscription Plans:

- **Free** ($0): 1 campaign, 1K visits
- **Starter** ($49): 2 campaigns, 50K visits
- **Growth** ($199): 3 campaigns, 250K visits
- **Business** ($349): 5 campaigns, 500K visits
- **Premium** ($599): 10 campaigns, 1M visits

### ✅ What's Included:

- Auto free tier for new users
- Campaign limit enforcement
- Stripe checkout integration
- Webhook handler for subscription events
- Upgrade/downgrade functionality
- Complete documentation

## Setup

```bash
npm install
cp .env.example .env
node src/server.js
```

### Configuration

Add to `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_STARTER=price_your_starter_id
STRIPE_PRICE_GROWTH=price_your_growth_id
STRIPE_PRICE_BUSINESS=price_your_business_id
STRIPE_PRICE_PREMIUM=price_your_premium_id
FRONTEND_URL=http://localhost:3000

# Traffic Vendors
SPARKTRAFFIC_API_KEY=your_sparktraffic_key  # Alpha campaigns
NINE_HITS_API_KEY=your_9hits_key            # Beta campaigns

# Database
MONGO_URI=mongodb://localhost:27017/trafficbox

# JWT
JWT_SECRET=your_jwt_secret_here

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_bucket_name
```

## API Endpoints

### Traffic Vendors

- **Alpha Campaigns** (`/api/alpha`) - SparkTraffic integration ✅
- **Beta Campaigns** (`/api/beta`) - 9hits integration 🚧

### Subscription Management

- `GET /api/subscription/subscription` - Get current subscription
- `GET /api/subscription/plans` - List all plans
- `POST /api/subscription/checkout` - Create checkout session
- `POST /api/subscription/upgrade` - Upgrade plan
- `POST /api/subscription/cancel` - Cancel subscription

### Alpha Campaigns (SparkTraffic) - Protected

- `POST /api/alpha/campaigns` - Create campaign (requires subscription check)
- `GET /api/alpha/campaigns` - List campaigns
- `GET /api/alpha/campaigns/:id` - Get campaign details
- `PUT /api/alpha/campaigns/:id/modify` - Update campaign
- `POST /api/alpha/campaigns/:id/pause` - Pause campaign
- `POST /api/alpha/campaigns/:id/resume` - Resume campaign

### Beta Campaigns (9hits) - Protected 🚧

- `GET /api/beta/profile` - Get 9hits profile ✅
- `POST /api/beta/campaigns` - Create campaign (coming soon)
- `GET /api/beta/campaigns` - List campaigns (coming soon)
- More endpoints pending API documentation

See **[STRIPE_API_REFERENCE.md](./STRIPE_API_REFERENCE.md)** for complete API documentation.
See **[BETA_API_TESTING.md](./BETA_API_TESTING.md)** for Beta API testing.
