import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController';

const router = Router();
const controller = new AuthController();


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, try again later.' },
});

router.post('/register', authLimiter, controller.register.bind(controller));
router.post('/login', authLimiter, controller.login.bind(controller));
router.post('/refresh', authLimiter, controller.refreshToken.bind(controller));

export default router;
