import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { AuthController } from '../controllers/authController';
import { asyncHandler } from '../middleware/errorHandler';

const router: ExpressRouter = Router();
const controller = new AuthController();

router.post('/register', asyncHandler(controller.register.bind(controller)));
router.post('/login', asyncHandler(controller.login.bind(controller)));
router.post('/refresh', asyncHandler(controller.refreshToken.bind(controller)));

export default router;
