/**
 * @swagger
 * /api/analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Get analytics summary
 *     description: Returns aggregated analytics for the authenticated user's accounts.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time period for the analytics
 *     responses:
 *       200:
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsSummary'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/analytics/usage:
 *   get:
 *     tags: [Analytics]
 *     summary: Get API usage stats
 *     description: Returns API usage statistics including request counts and rate limit data.
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-06-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-06-19"
 *     responses:
 *       200:
 *         description: Usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRequests:
 *                   type: integer
 *                   example: 5000
 *                 successRate:
 *                   type: number
 *                   example: 99.2
 *                 averageResponseTime:
 *                   type: number
 *                   description: Average response time in milliseconds
 *                   example: 145
 *                 byEndpoint:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                         example: "/api/accounts/{id}/credit-score"
 *                       count:
 *                         type: integer
 *                         example: 1200
 */
export {};
