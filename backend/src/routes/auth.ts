import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { authRouteLimiter } from '../middleware/expressRouteLimiters';
import { AuthController } from '../controllers/authController';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import {
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
} from '../schemas';

const router: ExpressRouter = Router();
const controller = new AuthController();

router.post(
  '/register',
  authRouteLimiter,
  validate({ body: registerBodySchema }),
  asyncHandler(controller.register.bind(controller)),
);

router.post(
  '/login',
  authRouteLimiter,
  validate({ body: loginBodySchema }),
  asyncHandler(controller.login.bind(controller)),
);

router.post(
  '/refresh',
  authRouteLimiter,
  validate({ body: refreshTokenBodySchema }),
  asyncHandler(controller.refreshToken.bind(controller)),
);

export default router;
