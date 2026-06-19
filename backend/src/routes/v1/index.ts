/**
 * API v1 router (deprecated).
 *
 * Aggregates the v1 surface area. Mounted by the version dispatcher and at the
 * explicit `/api/v1` path prefix. Paths here are version-agnostic — the
 * versioning middleware strips the `/v1` segment before routing.
 *
 * @deprecated v1 is scheduled for sunset; see /docs/api/migration/v1-to-v2.md
 */
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import accountRoutes from '../accounts';
import authRoutes from '../auth';
import { createFeatureFlagRouter } from '../featureFlags';
import { generateCreditScore, generateFraudResult, toCreditScoreV1, toFraudResultV1 } from '../shared/scoring';
import { createWebhookRouter } from '../webhooks';
import { prisma } from '../../prisma/client';
import { generalRateLimit } from '../middleware/rateLimiter';

const router: ExpressRouter = Router();

router.use('/accounts', accountRoutes);
router.use('/auth', authRoutes);
router.use('/feature-flags', createFeatureFlagRouter());
router.use('/webhooks', createWebhookRouter(prisma));

// GET /credit-score - flat v1 contract
router.get('/credit-score', generalRateLimit.middleware(), (_req, res) => {
  res.json({ success: true, data: toCreditScoreV1(generateCreditScore()) });
});

// GET /fraud/detect - flat v1 contract
router.get('/fraud/detect', generalRateLimit.middleware(), (_req, res) => {
  res.json({ success: true, data: toFraudResultV1(generateFraudResult()) });
});

export default router;
