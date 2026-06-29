/**
 * API v2 router (current).
 *
 * Aggregates the v2 surface area. Mounted by the version dispatcher and at the
 * explicit `/api/v2` path prefix. v2 introduces breaking changes to the credit
 * and fraud response shapes (nested objects + meta); see the changelog and
 * migration guide for details.
 */
import { Router } from 'express';
import type { Router as ExpressRouter, Request, Response } from 'express';
import accountRoutes from '../accounts';
import authRoutes from '../auth';
import { createFeatureFlagRouter } from '../featureFlags';
import { generateCreditScore, generateFraudResult, toCreditScoreV2, toFraudResultV2 } from '../shared/scoring';
import { validate } from '../../middleware/validation';
import { creditScoreQuerySchema, fraudDetectionQuerySchema, creditScoreCalculateSchema, creditScoreHistorySchema, fraudAnalyzeSchema, fraudAlertsQuerySchema, fraudAlertAcknowledgeSchema } from '../../schemas';
import { creditScoreService } from '../../services/creditScoreService';
import { fraudDetectionService } from '../../services/fraudDetectionService';
import { authenticate } from '../../middleware/auth';

const router: ExpressRouter = Router();

router.use('/accounts', accountRoutes);
router.use('/auth', authRoutes);
router.use('/feature-flags', createFeatureFlagRouter());

// GET /credit-score - nested v2 contract (legacy, kept for compatibility)
router.get(
  '/credit-score',
  validate({ query: creditScoreQuerySchema }),
  (_req, res) => {
    res.json({ success: true, data: toCreditScoreV2(generateCreditScore()) });
  }
);

// ---------------------------------------------------------------------------
// Credit Score Endpoints (/api/v2/credit-score)
// ---------------------------------------------------------------------------

// POST /credit-score/calculate - Calculate credit score for an account
router.post(
  '/credit-score/calculate',
  authenticate,
  validate({ body: creditScoreCalculateSchema }),
  async (req: Request, res: Response) => {
    const { accountId, userId, model, includeFactors } = req.body;
    const result = await creditScoreService.calculateScore(accountId, userId, model, includeFactors);
    
    res.json({
      success: true,
      data: {
        creditScore: {
          value: result.score,
          band: result.score >= 700 ? 'excellent' : result.score >= 580 ? 'fair' : 'poor',
          confidence: result.confidence,
          factors: result.factors,
        },
        meta: {
          generatedAt: result.generatedAt,
          model: result.model,
        },
      },
    });
  }
);

// GET /credit-score/history/:accountId - Get credit score history for an account
router.get(
  '/credit-score/history/:accountId',
  authenticate,
  validate({ query: creditScoreHistorySchema }),
  async (req: Request, res: Response) => {
    const { accountId } = req.params;
    const { limit, offset } = req.query as any;
    
    const result = await creditScoreService.getHistory(accountId, limit, offset);
    
    res.json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        limit,
        offset,
      },
    });
  }
);

// GET /credit-score/models - List available scoring models
router.get(
  '/credit-score/models',
  authenticate,
  async (_req: Request, res: Response) => {
    const models = await creditScoreService.getModels();
    
    res.json({
      success: true,
      data: {
        models,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// Fraud Detection Endpoints (/api/v2/fraud)
// ---------------------------------------------------------------------------

// GET /fraud/detect - nested v2 contract (legacy, kept for compatibility)
router.get(
  '/fraud/detect',
  validate({ query: fraudDetectionQuerySchema }),
  (_req, res) => {
    res.json({ success: true, data: toFraudResultV2(generateFraudResult()) });
  }
);

// POST /fraud/analyze - Analyze a transaction for fraud
router.post(
  '/fraud/analyze',
  authenticate,
  validate({ body: fraudAnalyzeSchema }),
  async (req: Request, res: Response) => {
    const result = await fraudDetectionService.analyzeTransaction(req.body);
    
    res.json({
      success: true,
      data: {
        fraud: {
          isFraud: result.isFraud,
          riskScore: result.riskScore,
          riskLevel: result.riskScore < 33 ? 'low' : result.riskScore < 66 ? 'medium' : 'high',
          factors: result.factors,
        },
        meta: {
          generatedAt: result.generatedAt,
          model: result.model,
        },
      },
    });
  }
);

// GET /fraud/alerts - Get paginated list of fraud alerts
router.get(
  '/fraud/alerts',
  authenticate,
  validate({ query: fraudAlertsQuerySchema }),
  async (req: Request, res: Response) => {
    const { limit, offset, resolved, alertType } = req.query as any;
    
    const result = await fraudDetectionService.getAlerts({ limit, offset, resolved, alertType });
    
    res.json({
      success: true,
      data: result,
    });
  }
);

// POST /fraud/alerts/:id/acknowledge - Mark a fraud alert as reviewed
router.post(
  '/fraud/alerts/:id/acknowledge',
  authenticate,
  validate({ body: fraudAlertAcknowledgeSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    const result = await fraudDetectionService.acknowledgeAlert(id, notes);
    
    res.json({
      success: true,
      data: result,
    });
  }
);

export default router;
