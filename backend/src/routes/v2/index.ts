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
import apiKeyRoutes from '../apiKeys';
import { createFeatureFlagRouter } from '../featureFlags';
import { generateCreditScore, generateFraudResult, toCreditScoreV2, toFraudResultV2 } from '../shared/scoring';

const router: ExpressRouter = Router();

router.use('/accounts', accountRoutes);
router.use('/auth', authRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/feature-flags', createFeatureFlagRouter());

// GET /credit-score - nested v2 contract
router.get('/credit-score', (_req, res) => {
  res.json({ success: true, data: toCreditScoreV2(generateCreditScore()) });
});

// GET /fraud/detect - nested v2 contract
router.get('/fraud/detect', (_req, res) => {
  res.json({ success: true, data: toFraudResultV2(generateFraudResult()) });
});

export default router;
