import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { AccountController } from '../controllers/accountController';
import { getRateLimitConfig, RATE_LIMIT_WINDOWS } from '../config/rateLimit';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import {
  accountIdParamsSchema,
  createAccountBodySchema,
  paginationQuerySchema,
} from '../schemas';

const router: ExpressRouter = Router();
const rateLimitConfig = getRateLimitConfig();

router.use(
  rateLimit({
    windowMs: rateLimitConfig.defaultIpLimit.windowMs,
    max: rateLimitConfig.defaultIpLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const createAccountLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOWS.hour,
  max: 5,
  message: { message: 'Too many account creation attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
  createAccountLimiter,
  validate({ body: createAccountBodySchema }),
  asyncHandler(AccountController.createAccount),
);

export default router;
