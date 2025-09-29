# Automated Credit Deduction System

## Overview

The automated credit deduction system monitors SparkTraffic campaigns and automatically deducts credits based on actual traffic delivered. The system runs every minute and tracks new hits to ensure accurate billing.

## How It Works

### 1. Campaign Tracking

- Each campaign tracks `last_stats_check` timestamp
- System maintains `total_hits_counted` to avoid double-charging
- New field `credit_deduction_enabled` allows enabling/disabling per campaign

### 2. Credit Deduction Process

- Runs every minute via cron job (`* * * * *`)
- Fetches stats from SparkTraffic API for date range since last check
- Calculates new hits since last check
- Deducts credits at 1 credit per hit (configurable)
- Updates campaign tracking fields

### 3. Smart Date Range Management

- First check: Only counts hits from today to avoid charging for historical data
- Subsequent checks: Uses `last_stats_check` as start date
- Always uses current date as end date

### 4. Safety Features

- Insufficient credits: Pauses campaign and disables auto-deduction
- API failures: Updates check time to prevent getting stuck
- Admin controls: Manual processing and bulk operations

## API Endpoints

### User Endpoints

#### Toggle Credit Deduction

```
POST /api/campaigns/:id/toggle-credit-deduction
Authorization: Bearer <token>
```

Enables/disables automatic credit deduction for a specific campaign.

#### Get Campaign Stats (with credit info)

```
GET /api/campaigns/:id/stats?from=2025-09-01&to=2025-09-29
Authorization: Bearer <token>
```

Returns campaign statistics including credit deduction information.

### Admin Endpoints

#### Manual Credit Processing (Single Campaign)

```
POST /api/campaigns/:id/process-credits
Authorization: Bearer <admin-token>
```

Manually triggers credit deduction for a specific campaign.

#### Bulk Credit Processing

```
POST /api/campaigns/admin/process-all-credits
Authorization: Bearer <admin-token>
```

Manually triggers credit deduction for all active campaigns.

#### Add Credits to User

```
POST /api/campaigns/user/:userId/add-credits
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "credits": 1000
}
```

## Environment Variables

### Required

- `SPARKTRAFFIC_API_KEY`: Your SparkTraffic API key

### Optional

- `CREDIT_DEDUCTION_CRON`: Cron expression for credit deduction job (default: `* * * * *`)
- `NODE_ENV`: Set to 'development' for debug logging

## Database Schema Updates

### Campaign Model

```javascript
{
  last_stats_check: Date,           // Last time we checked for stats
  total_hits_counted: Number,       // Total hits we've counted for billing
  total_visits_counted: Number,     // Total visits counted
  credit_deduction_enabled: Boolean // Enable/disable auto-deduction
}
```

## Credit Deduction Logic

### Rate Calculation

- **Current Rate**: 1 credit per hit
- **Configurable**: Change rate in `creditDeduction.js`

### Example Flow

1. Campaign has 100 total hits at first check (today)
2. System counts 100 hits, deducts 100 credits
3. Next check (1 minute later): 105 total hits
4. System deducts 5 credits for the 5 new hits
5. Process continues every minute

### Insufficient Credits Handling

When user has insufficient credits:

1. Campaign is automatically paused
2. Credit deduction is disabled
3. User must add credits and manually re-enable
4. Admin can override and add credits

## Monitoring and Logging

### Log Categories

- `[CAMPAIGN]`: Campaign-related operations
- `[SYNC]`: Sync worker operations
- `[INFO]`: General information
- `[ERROR]`: Error conditions
- `[DEBUG]`: Development debugging (NODE_ENV=development only)

### Log Files

- `logs/app.log`: All application logs
- `logs/error.log`: Error logs only
- `logs/campaigns.log`: Campaign-specific logs

### Key Metrics Logged

- Credits deducted per campaign
- Total campaigns processed
- API failures and recovery
- Insufficient credit events
- Campaign pause/resume events

## Troubleshooting

### Common Issues

#### Credits Not Being Deducted

1. Check `credit_deduction_enabled` flag on campaign
2. Verify SparkTraffic API key is configured
3. Check sync worker is running (server logs)
4. Review error logs for API failures

#### Double Charging

- System uses `total_hits_counted` to prevent double charging
- Each check only counts new hits since last check
- First check only counts today's hits

#### Campaign Stuck in Processing

- System updates `last_stats_check` even on errors
- Admin can manually trigger processing
- Check API connectivity and credentials

### Manual Recovery

```bash
# Restart credit deduction for all campaigns
POST /api/campaigns/admin/process-all-credits

# Reset a campaign's tracking (database direct)
db.campaigns.updateOne(
  {_id: ObjectId("campaign_id")},
  {$unset: {last_stats_check: 1, total_hits_counted: 1}}
)
```

## Security Considerations

- Admin-only endpoints for manual processing
- User-owned campaigns only (except admin override)
- API key protection in environment variables
- Rate limiting should be applied to admin endpoints
- Audit logging for all credit operations

## Performance Considerations

- Processes campaigns in batches
- Uses efficient MongoDB queries
- Minimal API calls to SparkTraffic
- Graceful error handling prevents blocking
- Debug logging disabled in production

## Future Enhancements

1. **Configurable Rates**: Per-campaign or per-user credit rates
2. **Credit Packages**: Different rates for different service tiers
3. **Usage Analytics**: Detailed reporting on credit consumption
4. **Alerts**: Email notifications for low credits
5. **Billing Integration**: Integration with payment processors
6. **Campaign Budgets**: Set maximum spend limits per campaign
