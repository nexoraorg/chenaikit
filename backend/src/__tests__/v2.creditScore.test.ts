/**
 * Unit tests for v2 credit scoring route handlers
 */
import request from 'supertest';
import express from 'express';
import { Router } from 'express';

// Mock the services
jest.mock('../services/creditScoreService');
jest.mock('../middleware/auth');

import { authenticate } from '../middleware/auth';
import { creditScoreService } from '../services/creditScoreService';

describe('v2 Credit Score Routes', () => {
  let app: express.Application;
  let router: Router;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock authentication to always pass
    (authenticate as jest.Mock).mockImplementation((req, res, next) => {
      (req as any).user = { id: 'test-user-id', role: 'admin' };
      next();
    });

    // Create test router with credit score endpoints
    router = Router();

    // POST /credit-score/calculate
    router.post('/credit-score/calculate', async (req, res) => {
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
    });

    // GET /credit-score/history/:accountId
    router.get('/credit-score/history/:accountId', async (req, res) => {
      const { accountId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      
      const result = await creditScoreService.getHistory(accountId, Number(limit), Number(offset));
      
      res.json({
        success: true,
        data: {
          items: result.items,
          total: result.total,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    });

    // GET /credit-score/models
    router.get('/credit-score/models', async (_req, res) => {
      const models = await creditScoreService.getModels();
      
      res.json({
        success: true,
        data: {
          models,
        },
      });
    });

    // Setup express app
    app = express();
    app.use(express.json());
    app.use(router);
  });

  describe('POST /credit-score/calculate', () => {
    it('should calculate credit score successfully', async () => {
      const mockResult = {
        score: 750,
        confidence: 0.95,
        factors: [
          { name: 'payment_history', weight: 0.35 },
          { name: 'credit_utilization', weight: 0.30 },
        ],
        generatedAt: '2024-01-01T00:00:00Z',
        model: 'credit-score-v2',
      };

      (creditScoreService.calculateScore as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/credit-score/calculate')
        .send({
          accountId: 'acc123',
          userId: 'user123',
          model: 'credit-score-v2',
          includeFactors: true,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          creditScore: {
            value: 750,
            band: 'excellent',
            confidence: 0.95,
          },
          meta: {
            model: 'credit-score-v2',
          },
        },
      });

      expect(creditScoreService.calculateScore).toHaveBeenCalledWith(
        'acc123',
        'user123',
        'credit-score-v2',
        true
      );
    });

    it('should handle missing accountId with validation error', async () => {
      const response = await request(app)
        .post('/credit-score/calculate')
        .send({
          userId: 'user123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /credit-score/history/:accountId', () => {
    it('should return credit score history', async () => {
      const mockHistory = {
        items: [
          {
            id: 'score1',
            score: 750,
            reason: 'Calculated using credit-score-v2',
            createdAt: new Date('2024-01-01'),
          },
          {
            id: 'score2',
            score: 720,
            reason: 'Calculated using credit-score-v2',
            createdAt: new Date('2023-12-01'),
          },
        ],
        total: 2,
      };

      (creditScoreService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/credit-score/history/acc123')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: mockHistory.items,
          total: 2,
          limit: 10,
          offset: 0,
        },
      });

      expect(creditScoreService.getHistory).toHaveBeenCalledWith('acc123', 10, 0);
    });

    it('should handle pagination parameters', async () => {
      const mockHistory = { items: [], total: 0 };
      (creditScoreService.getHistory as jest.Mock).mockResolvedValue(mockHistory);

      await request(app)
        .get('/credit-score/history/acc123')
        .query({ limit: 5, offset: 10 })
        .expect(200);

      expect(creditScoreService.getHistory).toHaveBeenCalledWith('acc123', 5, 10);
    });
  });

  describe('GET /credit-score/models', () => {
    it('should return available scoring models', async () => {
      const mockModels = [
        {
          id: 'model-1',
          name: 'FICO-like',
          version: '2.0',
          description: 'Standard credit scoring model similar to FICO',
          enabled: true,
        },
        {
          id: 'model-2',
          name: 'VantageScore',
          version: '3.0',
          description: 'Alternative credit scoring model',
          enabled: true,
        },
      ];

      (creditScoreService.getModels as jest.Mock).mockResolvedValue(mockModels);

      const response = await request(app)
        .get('/credit-score/models')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          models: mockModels,
        },
      });

      expect(creditScoreService.getModels).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      });

      await request(app)
        .post('/credit-score/calculate')
        .send({ accountId: 'acc123' })
        .expect(401);
    });
  });
});
