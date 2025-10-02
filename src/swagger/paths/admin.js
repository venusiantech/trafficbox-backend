/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Admin Dashboard Overview
 *     description: Get comprehensive dashboard statistics for admin users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminDashboard'
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
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all users with pagination
 *     description: Get paginated list of all users with details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
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
 * /api/admin/campaigns:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all campaigns with details
 *     description: Get paginated list of all campaigns with user details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of campaigns per page
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
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
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
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
 * /api/admin/users/{userId}:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get user details with campaigns
 *     description: Get detailed information about a specific user including their campaigns
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
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
 * /api/admin/users/{userId}/credits:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update user credits and hits
 *     description: Update a user's credits and available hits
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
 *             properties:
 *               credits:
 *                 type: number
 *                 example: 5000
 *               availableHits:
 *                 type: number
 *                 example: 1666
 *     responses:
 *       200:
 *         description: User credits updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
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
 * /api/admin/campaigns/{campaignId}/{action}:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Force pause/resume campaign
 *     description: Admin override to pause or resume any campaign
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pause, resume]
 *         description: Action to perform
 *     responses:
 *       200:
 *         description: Campaign action performed successfully
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
 *                   example: "Campaign paused by admin"
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 vendorResp:
 *                   type: object
 *       400:
 *         description: Invalid action
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
 * /api/admin/campaigns/{campaignId}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Delete campaign (Admin override)
 *     description: Admin can force delete any campaign, bypassing user ownership
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
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
 *                   example: "Campaign deleted by admin"
 *       404:
 *         description: Campaign not found
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
 * /api/admin/analytics:
 *   get:
 *     tags:
 *       - Admin
 *     summary: System analytics
 *     description: Get detailed system analytics and statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     userGrowth:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           count:
 *                             type: number
 *                     campaignStats:
 *                       type: object
 *                       properties:
 *                         byVendor:
 *                           type: object
 *                         byState:
 *                           type: object
 *                     creditUsage:
 *                       type: object
 *                       properties:
 *                         totalAllocated:
 *                           type: number
 *                         totalUsed:
 *                           type: number
 *                         remaining:
 *                           type: number
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
 * /api/admin/search:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Search users and campaigns
 *     description: Search across users and campaigns with query parameters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [users, campaigns, all]
 *           default: all
 *         description: Search type
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     campaigns:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Campaign'
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
 * /api/admin/archives/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get archive statistics
 *     description: Get statistics about archived campaigns and deletion eligibility
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Archive statistics retrieved successfully
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
 *                     totalArchived:
 *                       type: number
 *                       example: 25
 *                     eligibleForDeletion:
 *                       type: number
 *                       example: 3
 *                     averageDaysArchived:
 *                       type: number
 *                       example: 4.2
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
 * /api/admin/archives/cleanup:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Run cleanup job manually
 *     description: Manually trigger the archive cleanup job to mark campaigns eligible for deletion
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup job completed successfully
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
 *                   example: "Cleanup completed"
 *                 result:
 *                   type: object
 *                   properties:
 *                     modifiedCount:
 *                       type: number
 *                       example: 2
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
 * /api/admin/archives/campaigns:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all archived campaigns
 *     description: Get all archived campaigns across all users for admin oversight
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Campaign'
 *                       - type: object
 *                         properties:
 *                           user:
 *                             $ref: '#/components/schemas/User'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalArchived:
 *                       type: number
 *                     eligibleForDeletion:
 *                       type: number
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
 * /api/admin/credit-system/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get credit system statistics
 *     description: Get comprehensive statistics about the automated credit deduction system
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Credit system statistics retrieved successfully
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
 *                     totalCampaignsWithDeduction:
 *                       type: number
 *                       description: "Number of campaigns with credit deduction enabled"
 *                     totalHitsProcessed:
 *                       type: number
 *                       description: "Total hits processed across all campaigns"
 *                     totalCreditsDeducted:
 *                       type: number
 *                       description: "Total credits deducted from all users"
 *                     averageHitsPerCampaign:
 *                       type: number
 *                       description: "Average hits per campaign"
 *                     lastProcessingRun:
 *                       type: string
 *                       format: date-time
 *                       description: "Timestamp of last automatic processing"
 *                     campaignsProcessedLast24h:
 *                       type: number
 *                       description: "Number of campaigns processed in last 24 hours"
 *       403:
 *         description: Forbidden (admin only)
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
 * /api/admin/migration/geo-format/status:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Check geo format migration status
 *     description: Get status of campaigns that need migration to new geo format
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Migration status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: object
 *                   properties:
 *                     totalCampaigns:
 *                       type: number
 *                       description: "Total number of campaigns"
 *                     usingNewFormat:
 *                       type: number
 *                       description: "Campaigns already using new geo format"
 *                     needsMigration:
 *                       type: number
 *                       description: "Campaigns that need migration"
 *                     migrationProgress:
 *                       type: number
 *                       description: "Migration progress percentage"
 *                     sampleOldFormat:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           campaignId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           currentGeoFormat:
 *                             type: array
 *                       description: "Sample campaigns with old format"
 *       403:
 *         description: Forbidden (admin only)
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
