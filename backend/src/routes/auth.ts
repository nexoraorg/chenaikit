import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController';
import { asyncHandler } from '../middleware/errorHandler';

const router: ExpressRouter = Router();
const controller = new AuthController();


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, try again later.' },
  // Skip rate limiting entirely in test environments so test suites don't
  // exhaust the window when the in-process app is reused across test files.
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authLimiter, asyncHandler(controller.register.bind(controller)));
router.post('/login', authLimiter, asyncHandler(controller.login.bind(controller)));
router.post('/refresh', authLimiter, asyncHandler(controller.refreshToken.bind(controller)));

export default router;
