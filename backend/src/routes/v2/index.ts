/**
 * API v2 router (current).
 *
 * Aggregates the v2 surface area. Mounted by the version dispatcher and at the
 * explicit `/api/v2` path prefix. v2 introduces breaking changes to the credit
 * and fraud response shapes (nested objects + meta); see the changelog and
 * migration guide for details.
 */
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import accountRoutes from '../accounts';
import authRoutes from '../auth';
import { createFeatureFlagRouter } from '../featureFlags';
import { createMLModelRouter } from '../mlModels';
import { generateCreditScore, generateFraudResult, toCreditScoreV2, toFraudResultV2 } from '../shared/scoring';
import { validate } from '../../middleware/validation';
import { creditScoreQuerySchema, fraudDetectionQuerySchema } from '../../schemas';
import { prisma } from '../../prisma/client';

const router: ExpressRouter = Router();

router.use('/accounts', accountRoutes);
router.use('/auth', authRoutes);
router.use('/feature-flags', createFeatureFlagRouter());
router.use('/ml-models', createMLModelRouter(prisma));

// GET /credit-score - nested v2 contract
router.get(
  '/credit-score',
  validate({ query: creditScoreQuerySchema }),
  (_req, res) => {
    res.json({ success: true, data: toCreditScoreV2(generateCreditScore()) });
  }
);

// GET /fraud/detect - nested v2 contract
router.get(
  '/fraud/detect',
  validate({ query: fraudDetectionQuerySchema }),
  (_req, res) => {
    res.json({ success: true, data: toFraudResultV2(generateFraudResult()) });
  }
);

export default router;
