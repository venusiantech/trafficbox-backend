# 9Hits Backend Skeleton

Tech stack: Node.js + Express + Mongoose

## 🎉 NEW: Stripe Subscription System Integrated!

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

### Stripe Configuration

Add to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_STARTER=price_your_starter_id
STRIPE_PRICE_GROWTH=price_your_growth_id
STRIPE_PRICE_BUSINESS=price_your_business_id
STRIPE_PRICE_PREMIUM=price_your_premium_id
FRONTEND_URL=http://localhost:3000
```

## API Endpoints

### Subscription Management

- `GET /api/subscription/subscription` - Get current subscription
- `GET /api/subscription/plans` - List all plans
- `POST /api/subscription/checkout` - Create checkout session
- `POST /api/subscription/upgrade` - Upgrade plan
- `POST /api/subscription/cancel` - Cancel subscription

### Campaigns (Protected)

- `POST /api/alpha/campaigns` - Create campaign (requires subscription check)

See **[STRIPE_API_REFERENCE.md](./STRIPE_API_REFERENCE.md)** for complete API documentation.
