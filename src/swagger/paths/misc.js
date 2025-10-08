/**
 * @swagger
 * /api/me:
 *   get:
 *     tags:
 *       - Account
 *     summary: Get current user profile
 *     description: Get current authenticated user's profile information including credits and available hits. Password field is excluded for security.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: User ID
 *                   example: "68ce78a2d1017aa5b1da3e6a"
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User email address
 *                   example: "azamtest3@gmail.com"
 *                 firstName:
 *                   type: string
 *                   description: User first name
 *                   example: "Azam"
 *                 lastName:
 *                   type: string
 *                   description: User last name
 *                   example: "Mohd"
 *                 dob:
 *                   type: string
 *                   format: date-time
 *                   description: Date of birth
 *                   example: "1990-01-01T00:00:00.000Z"
 *                 role:
 *                   type: string
 *                   enum: ["user", "admin"]
 *                   description: User role
 *                   example: "user"
 *                 cashBalance:
 *                   type: number
 *                   description: User cash balance
 *                   example: 0
 *                 credits:
 *                   type: number
 *                   description: User credits available for campaigns
 *                   example: 4787
 *                 availableHits:
 *                   type: number
 *                   description: Available hits (credits/3) for campaign creation
 *                   example: 1527
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: User account creation timestamp
 *                   example: "2025-09-20T09:49:22.697Z"
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: User account last update timestamp
 *                   example: "2025-10-04T09:39:47.098Z"
 *             examples:
 *               user_profile:
 *                 summary: Secure user profile response (no password)
 *                 value:
 *                   id: "68ce78a2d1017aa5b1da3e6a"
 *                   email: "azamtest3@gmail.com"
 *                   firstName: "Azam"
 *                   lastName: "Mohd"
 *                   dob: "1990-01-01T00:00:00.000Z"
 *                   role: "user"
 *                   cashBalance: 0
 *                   credits: 4787
 *                   availableHits: 1527
 *                   createdAt: "2025-09-20T09:49:22.697Z"
 *                   updatedAt: "2025-10-04T09:39:47.098Z"
 *       401:
 *         description: Unauthorized
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/websites:
 *   get:
 *     tags:
 *       - Websites
 *     summary: Get user's websites
 *     description: Get all websites/campaigns for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Websites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 websites:
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
 *   post:
 *     tags:
 *       - Websites
 *     summary: Add a new website
 *     description: Add a new website/campaign for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *     responses:
 *       201:
 *         description: Website added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 website:
 *                   $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Bad request
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
