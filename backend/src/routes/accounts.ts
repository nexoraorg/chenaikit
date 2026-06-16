import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { AccountController } from '../controllers/accountController';
import { ValidationMiddleware } from '../middleware/validation';
import { generalRateLimit, createAccountRateLimit } from '../middleware/rateLimiter';

const router: ExpressRouter = Router();

// Apply general rate limiting to all account routes
router.use(generalRateLimit.middleware());

/**
 * @openapi
 * /api/accounts/{id}:
 *   get:
 *     summary: Get account details
 *     description: Retrieves full account details by account ID (public key).
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID (Stellar public key)
 *         example: GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK
 *     responses:
 *       200:
 *         description: Account found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Account'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       410:
 *         description: Account is inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/accounts/:id - Get account details
router.get(
  '/:id',
  ValidationMiddleware.validateAccountId,
  AccountController.getAccount
);

/**
 * @openapi
 * /api/accounts/{id}/balance:
 *   get:
 *     summary: Get account balance
 *     description: Returns the current balance for a specific account.
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID (Stellar public key)
 *     responses:
 *       200:
 *         description: Balance retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       format: double
 *                       example: 1000.50
 *                     accountId:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       410:
 *         description: Account is inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/accounts/:id/balance - Get account balance
router.get(
  '/:id/balance',
  ValidationMiddleware.validateAccountId,
  AccountController.getAccountBalance
);

/**
 * @openapi
 * /api/accounts/{id}/transactions:
 *   get:
 *     summary: Get account transactions
 *     description: Returns a paginated list of transactions for the specified account, with sorting options.
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID (Stellar public key)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [timestamp, amount]
 *           default: timestamp
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Paginated transaction list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTransactions'
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/accounts/:id/transactions - Get account transactions with pagination
router.get(
  '/:id/transactions',
  ValidationMiddleware.validateAccountId,
  ValidationMiddleware.validatePagination,
  AccountController.getAccountTransactions
);

/**
 * @openapi
 * /api/accounts:
 *   post:
 *     summary: Create a new account
 *     description: Creates a new account with name, email, and Stellar public key. Rate limited to prevent abuse.
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AccountCreationRequest'
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Account'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       409:
 *         description: Account or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// POST /api/accounts - Create new account
router.post(
  '/',
  createAccountRateLimit.middleware(),
  ValidationMiddleware.sanitizeInput,
  ValidationMiddleware.validateAccountCreation,
  AccountController.createAccount
);

export default router;