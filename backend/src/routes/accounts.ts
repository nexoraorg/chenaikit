import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { AccountController } from '../controllers/accountController';
import { ValidationMiddleware } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router: ExpressRouter = Router();

// GET /api/accounts/:id - Get account details
router.get(
  '/:id',
  ValidationMiddleware.validateAccountId,
  asyncHandler(AccountController.getAccount)
);

// GET /api/accounts/:id/balance - Get account balance
router.get(
  '/:id/balance',
  ValidationMiddleware.validateAccountId,
  asyncHandler(AccountController.getAccountBalance)
);

// GET /api/accounts/:id/transactions - Get account transactions with pagination
router.get(
  '/:id/transactions',
  ValidationMiddleware.validateAccountId,
  ValidationMiddleware.validatePagination,
  asyncHandler(AccountController.getAccountTransactions)
);

// POST /api/accounts - Create new account
router.post(
  '/',
  ValidationMiddleware.sanitizeInput,
  ValidationMiddleware.validateAccountCreation,
  asyncHandler(AccountController.createAccount)
);

export default router;
