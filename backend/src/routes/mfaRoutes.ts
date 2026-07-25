import { Router, Request, Response, NextFunction } from 'express';
import { MFAController } from '../controllers/mfaController';
import { authenticate } from '../middleware/auth';

const router: Router = Router();
const controller = new MFAController();

// Rate limiter specifically for MFA endpoints (5 attempts per 5 minutes)
const mfaRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const limiter = new (require('../middleware/rateLimiter').RateLimiter)({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: 'Too many MFA attempts. Please try again in 5 minutes.',
  });
  return limiter.middleware()(req, res, next);
};

// All MFA routes require authentication
router.use(authenticate);

// MFA setup and management
router.post('/setup', mfaRateLimit, controller.setup.bind(controller));
router.post('/verify', mfaRateLimit, controller.verify.bind(controller));
router.post('/challenge', mfaRateLimit, controller.challenge.bind(controller));
router.post('/disable', mfaRateLimit, controller.disable.bind(controller));
router.get('/status', controller.status.bind(controller));

// Backup codes
router.get('/backup-codes', controller.getBackupCodes.bind(controller));
router.post('/backup-codes/regenerate', mfaRateLimit, controller.regenerateBackupCodes.bind(controller));

// Recovery flow
router.post('/recovery/send', mfaRateLimit, controller.sendRecovery.bind(controller));
router.post('/recovery/complete', mfaRateLimit, controller.completeRecovery.bind(controller));

export default router;