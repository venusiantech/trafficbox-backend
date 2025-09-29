/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Create a new campaign
 *     description: Create a new campaign with SparkTraffic or 9Hits integration. Deducts hits from user's available balance.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *           examples:
 *             sparkTraffic_basic:
 *               summary: Basic SparkTraffic campaign
 *               value:
 *                 vendor: "sparkTraffic"
 *                 url: "https://trafficboxes.com"
 *                 title: "trafficboxes"
 *                 maxHits: 10
 *                 is_adult: false
 *                 is_coin_mining: false
 *             sparkTraffic_advanced:
 *               summary: Advanced SparkTraffic campaign with full configuration
 *               value:
 *                 url: "trafficboxes.com"
 *                 title: "trafficboxes"
 *                 urls: ["https://trafficboxes.com"]
 *                 keywords: "test,traffic"
 *                 referrers:
 *                   mode: "basic"
 *                   urls: ["https://ref.com"]
 *                 languages: "en"
 *                 bounce_rate: 0
 *                 return_rate: 0
 *                 click_outbound_events: 0
 *                 form_submit_events: 0
 *                 scroll_events: 0
 *                 time_on_page: "2sec"
 *                 desktop_rate: 2
 *                 auto_renew: "true"
 *                 geo_type: "countries"
 *                 geo: "US"
 *                 shortener: ""
 *                 rss_feed: ""
 *                 ga_id: ""
 *                 size: "eco"
 *                 speed: 200
 *             nineHits:
 *               summary: 9Hits campaign
 *               value:
 *                 vendor: "nineHits"
 *                 url: "https://example.com"
 *                 title: "My 9Hits Campaign"
 *                 maxHits: 5
 *                 duration: [5, 15]
 *     responses:
 *       200:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorRaw:
 *                   type: object
 *                   description: Raw response from SparkTraffic API
 *                   properties:
 *                     new-id:
 *                       type: string
 *                       description: SparkTraffic project ID
 *                       example: "3252C8DA071E"
 *                 resumeRaw:
 *                   type: object
 *                   description: Response from auto-resume attempt after campaign creation
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "ok"
 *                     - type: object
 *                       properties:
 *                         error:
 *                           type: string
 *                           example: "Request failed with status code 404"
 *                 userStats:
 *                   type: object
 *                   properties:
 *                     hitsDeducted:
 *                       type: number
 *                       description: Number of hits deducted from user's balance
 *                       example: 5
 *                     remainingHits:
 *                       type: number
 *                       description: User's remaining available hits
 *                       example: 1646
 *             examples:
 *               successful_creation:
 *                 summary: Successful campaign creation with SparkTraffic
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     user: "68ce78a2d1017aa5b1da3e6a"
 *                     title: "trafficboxes"
 *                     urls: ["https://trafficboxes.com"]
 *                     duration_min: 5
 *                     duration_max: 15
 *                     countries: []
 *                     rule: "any"
 *                     macros: ""
 *                     is_adult: false
 *                     is_coin_mining: false
 *                     state: "created"
 *                     spark_traffic_project_id: "3252C8DA071E"
 *                     spark_traffic_data:
 *                       new-id: "3252C8DA071E"
 *                     is_archived: false
 *                     delete_eligible: false
 *                     _id: "68d593b3b793dbe7779b73b4"
 *                     createdAt: "2025-09-25T19:10:43.467Z"
 *                     updatedAt: "2025-09-25T19:10:43.467Z"
 *                     __v: 0
 *                   vendorRaw:
 *                     new-id: "3252C8DA071E"
 *                   resumeRaw:
 *                     error: "Request failed with status code 404"
 *                   userStats:
 *                     hitsDeducted: 5
 *                     remainingHits: 1646
 *       400:
 *         description: Bad request (invalid URL, insufficient hits, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get campaign details
 *     description: Retrieve details of a specific campaign
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not your campaign)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags:
 *       - Campaigns
 *     summary: Update campaign
 *     description: Update campaign details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               max_hits:
 *                 type: number
 *               macros:
 *                 type: string
 *               popup_macros:
 *                 type: string
 *               is_adult:
 *                 type: boolean
 *               is_coin_mining:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags:
 *       - Campaigns
 *     summary: Archive campaign (soft delete)
 *     description: Archive a campaign using SparkTraffic modify-website-traffic-project API (speed=0) or 9Hits pause API. Campaign is soft-deleted with 7-day restoration period. If called again on already archived campaign that's delete_eligible, performs permanent deletion.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: "68d580f36550b230cd374d43"
 *     responses:
 *       200:
 *         description: Campaign archived successfully or permanently deleted if eligible
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Campaign archived successfully. Will be permanently deleted after 7 days."
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *                   description: Response from SparkTraffic or 9Hits API
 *                   example:
 *                     status: "ok"
 *                 action:
 *                   type: string
 *                   enum: ['archived', 'permanent_delete']
 *                   description: Action performed on the campaign
 *                   example: "archived"
 *             examples:
 *               archived:
 *                 summary: Campaign archived successfully
 *                 value:
 *                   ok: true
 *                   message: "Campaign archived successfully. Will be permanently deleted after 7 days."
 *                   campaign:
 *                     _id: "68d580f36550b230cd374d43"
 *                     title: "trafficboxes"
 *                     state: "archived"
 *                     is_archived: true
 *                     archived_at: "2025-09-25T18:59:07.861Z"
 *                     spark_traffic_project_id: "9B51FA9DCDEA"
 *                   vendorResp:
 *                     status: "ok"
 *                   action: "archived"
 *               permanent_delete:
 *                 summary: Campaign permanently deleted
 *                 value:
 *                   ok: true
 *                   message: "Campaign permanently deleted"
 *                   action: "permanent_delete"
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not campaign owner or admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/{id}/pause:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Pause campaign
 *     description: Pause a running or active campaign using SparkTraffic modify-website-traffic-project API (speed=0) or 9Hits sitePause API. Sets campaign state to "paused".
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: "68d580f36550b230cd374d43"
 *     responses:
 *       200:
 *         description: Campaign paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *                   description: Response from SparkTraffic or 9Hits API
 *                   example:
 *                     status: "ok"
 *             examples:
 *               sparktraffic_success:
 *                 summary: SparkTraffic campaign paused successfully
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     _id: "68d580f36550b230cd374d43"
 *                     title: "trafficboxes"
 *                     state: "paused"
 *                     is_archived: true
 *                     spark_traffic_project_id: "9B51FA9DCDEA"
 *                     urls: ["https://trafficboxes.com"]
 *                   vendorResp:
 *                     status: "ok"
 *               ninehits_success:
 *                 summary: 9Hits campaign paused successfully
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     _id: "68d580f36550b230cd374d43"
 *                     title: "My 9Hits Campaign"
 *                     state: "paused"
 *                     nine_hits_campaign_id: "12345"
 *                   vendorResp:
 *                     status: "success"
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not campaign owner or admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/{id}/resume:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Resume campaign
 *     description: Resume a paused or archived campaign using SparkTraffic modify-website-traffic-project API (speed=200) or 9Hits siteUpdate API. Sets campaign state to "ok" and userState to "running".
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: "68d580f36550b230cd374d43"
 *     responses:
 *       200:
 *         description: Campaign resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *                   description: Response from SparkTraffic or 9Hits API
 *                   example:
 *                     status: "ok"
 *             examples:
 *               sparktraffic_success:
 *                 summary: SparkTraffic campaign resumed successfully
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     _id: "68d580f36550b230cd374d43"
 *                     title: "trafficboxes"
 *                     state: "ok"
 *                     userState: "running"
 *                     is_archived: true
 *                     spark_traffic_project_id: "9B51FA9DCDEA"
 *                     urls: ["https://trafficboxes.com"]
 *                   vendorResp:
 *                     status: "ok"
 *               ninehits_success:
 *                 summary: 9Hits campaign resumed successfully
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     _id: "68d580f36550b230cd374d43"
 *                     title: "My 9Hits Campaign"
 *                     state: "ok"
 *                     userState: "running"
 *                     nine_hits_campaign_id: "12345"
 *                   vendorResp:
 *                     status: "success"
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not campaign owner or admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/{id}/restore:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Restore archived campaign
 *     description: Restore an archived campaign within the 7-day grace period
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Campaign restored successfully"
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *       400:
 *         description: Campaign is not archived or eligible for deletion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/archived:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get archived campaigns
 *     description: Get all archived campaigns for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Archived campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/user/stats:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get user stats
 *     description: Get user's credits and available hits information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     credits:
 *                       type: number
 *                       example: 5000
 *                     availableHits:
 *                       type: number
 *                       example: 1666
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/user/{userId}/add-credits:
 *   post:
 *     tags:
 *       - Campaigns
 *     summary: Add credits to user (Admin only)
 *     description: Add credits to a specific user's account (admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ['credits']
 *             properties:
 *               credits:
 *                 type: number
 *                 example: 1000
 *                 description: Number of credits to add
 *     responses:
 *       200:
 *         description: Credits added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Credits added successfully"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credits amount
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (admin only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/campaigns/{id}/stats:
 *   get:
 *     tags:
 *       - Campaigns
 *     summary: Get campaign statistics
 *     description: Get daily hits and visits report for a SparkTraffic campaign using the get-website-traffic-project-stats API. Returns statistics for the specified date range or last 30 days by default.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *         example: "68d580f36550b230cd374d43"
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date (YYYY-MM-DD format)
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date (YYYY-MM-DD format)
 *         example: "2024-01-31"
 *       - in: query
 *         name: include_archived
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Include archived campaigns
 *         example: false
 *     responses:
 *       200:
 *         description: Campaign statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 campaign:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "68d580f36550b230cd374d43"
 *                     title:
 *                       type: string
 *                       example: "trafficboxes"
 *                     spark_traffic_project_id:
 *                       type: string
 *                       example: "9B51FA9DCDEA"
 *                 dateRange:
 *                   type: object
 *                   properties:
 *                     from:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-01"
 *                     to:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-31"
 *                 stats:
 *                   type: object
 *                   description: Statistics data from SparkTraffic API
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "ok"
 *             examples:
 *               successful_stats:
 *                 summary: Successful statistics retrieval
 *                 value:
 *                   ok: true
 *                   campaign:
 *                     id: "68d580f36550b230cd374d43"
 *                     title: "trafficboxes"
 *                     spark_traffic_project_id: "9B51FA9DCDEA"
 *                   dateRange:
 *                     from: "2024-01-01"
 *                     to: "2024-01-31"
 *                   stats:
 *                     status: "ok"
 *       400:
 *         description: Bad request (invalid date format, non-SparkTraffic campaign)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_date_format:
 *                 summary: Invalid date format
 *                 value:
 *                   error: "Invalid 'from' date format. Use YYYY-MM-DD (e.g., 2024-01-01)"
 *               non_sparktraffic_campaign:
 *                 summary: Non-SparkTraffic campaign
 *                 value:
 *                   error: "Statistics are only available for SparkTraffic campaigns"
 *       404:
 *         description: Campaign not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not campaign owner or admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error or SparkTraffic API error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch campaign statistics"
 *                 details:
 *                   type: string
 *                   example: "Request failed with status code 400"
 *                 status:
 *                   type: number
 *                   example: 400
 *                 apiResponse:
 *                   type: object
 *                   description: Raw response from SparkTraffic API
 *                 dateRange:
 *                   type: object
 *                   properties:
 *                     from:
 *                       type: string
 *                       format: date
 *                     to:
 *                       type: string
 *                       format: date
 */
