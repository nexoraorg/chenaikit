import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { ValidationMiddleware } from '../middleware/validation';
import { generalRateLimit, createAccountRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Apply general rate limiting to all account routes
router.use(generalRateLimit.middleware());

// GET /api/accounts/:id - Get account details
router.get(
  '/:id',
  ValidationMiddleware.validateAccountId,
  AccountController.getAccount
);

// GET /api/accounts/:id/balance - Get account balance
router.get(
  '/:id/balance',
  ValidationMiddleware.validateAccountId,
  AccountController.getAccountBalance
);

// GET /api/accounts/:id/transactions - Get account transactions with pagination
router.get(
  '/:id/transactions',
  ValidationMiddleware.validateAccountId,
  ValidationMiddleware.validatePagination,
  AccountController.getAccountTransactions
);

// POST /api/accounts - Create new account
router.post(
  '/',
  createAccountRateLimit.middleware(),
  ValidationMiddleware.sanitizeInput,
  ValidationMiddleware.validateAccountCreation,
  AccountController.createAccount
);

export default router;