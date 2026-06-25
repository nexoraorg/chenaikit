import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { createAccountRouteLimiter } from '../middleware/expressRouteLimiters';
import { AccountController } from '../controllers/accountController';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import {
  accountIdParamsSchema,
  createAccountBodySchema,
  paginationQuerySchema,
} from '../schemas';

const router: ExpressRouter = Router();

// GET /api/accounts/:id - Get account details
router.get(
  '/:id',
  validate({ params: accountIdParamsSchema }),
  asyncHandler(AccountController.getAccount),
);

// GET /api/accounts/:id/balance - Get account balance
router.get(
  '/:id/balance',
  validate({ params: accountIdParamsSchema }),
  asyncHandler(AccountController.getAccountBalance),
);

// GET /api/accounts/:id/transactions - Get account transactions with pagination
router.get(
  '/:id/transactions',
  validate({ params: accountIdParamsSchema, query: paginationQuerySchema }),
  asyncHandler(AccountController.getAccountTransactions),
);

// POST /api/accounts - Create new account
router.post(
  '/',
  createAccountRouteLimiter,
  validate({ body: createAccountBodySchema }),
  asyncHandler(AccountController.createAccount),
);

export default router;
