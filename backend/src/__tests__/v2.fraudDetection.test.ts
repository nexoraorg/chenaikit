/**
 * Unit tests for v2 fraud detection route handlers
 */
import request from 'supertest';
import express from 'express';
import { Router } from 'express';

// Mock the services
jest.mock('../services/fraudDetectionService');
jest.mock('../middleware/auth');

import { authenticate } from '../middleware/auth';
import { fraudDetectionService } from '../services/fraudDetectionService';

describe('v2 Fraud Detection Routes', () => {
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

    // Create test router with fraud detection endpoints
    router = Router();

    // POST /fraud/analyze
    router.post('/fraud/analyze', async (req, res) => {
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
    });

    // GET /fraud/alerts
    router.get('/fraud/alerts', async (req, res) => {
      const { limit, offset, resolved, alertType } = req.query;
      
      const result = await fraudDetectionService.getAlerts({
        limit: Number(limit),
        offset: Number(offset),
        resolved: resolved !== undefined ? resolved === 'true' : undefined,
        alertType: alertType as string,
      });
      
      res.json({
        success: true,
        data: result,
      });
    });

    // POST /fraud/alerts/:id/acknowledge
    router.post('/fraud/alerts/:id/acknowledge', async (req, res) => {
      const { id } = req.params;
      const { notes } = req.body;
      
      const result = await fraudDetectionService.acknowledgeAlert(id, notes);
      
      res.json({
        success: true,
        data: result,
      });
    });

    // Setup express app
    app = express();
    app.use(express.json());
    app.use(router);
  });

  describe('POST /fraud/analyze', () => {
    it('should analyze transaction for fraud successfully', async () => {
      const mockResult = {
        isFraud: false,
        riskScore: 25,
        factors: [
          { name: 'transaction_amount', weight: 0.1 },
          { name: 'location', weight: 0.25 },
        ],
        generatedAt: '2024-01-01T00:00:00Z',
        model: 'fraud-detect-v2',
      };

      (fraudDetectionService.analyzeTransaction as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/fraud/analyze')
        .send({
          transactionId: 'tx123',
          accountId: 'acc123',
          amount: 100,
          currency: 'USD',
          merchant: 'Test Merchant',
          location: { latitude: 40.7128, longitude: -74.0060 },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          fraud: {
            isFraud: false,
            riskScore: 25,
            riskLevel: 'low',
          },
          meta: {
            model: 'fraud-detect-v2',
          },
        },
      });

      expect(fraudDetectionService.analyzeTransaction).toHaveBeenCalledWith({
        transactionId: 'tx123',
        accountId: 'acc123',
        amount: 100,
        currency: 'USD',
        merchant: 'Test Merchant',
        location: { latitude: 40.7128, longitude: -74.0060 },
      });
    });

    it('should detect high risk transaction', async () => {
      const mockResult = {
        isFraud: true,
        riskScore: 85,
        factors: [
          { name: 'transaction_amount', weight: 0.3 },
          { name: 'ip_reputation', weight: 0.15 },
        ],
        generatedAt: '2024-01-01T00:00:00Z',
        model: 'fraud-detect-v2',
      };

      (fraudDetectionService.analyzeTransaction as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/fraud/analyze')
        .send({
          accountId: 'acc123',
          amount: 10000,
          currency: 'USD',
        })
        .expect(200);

      expect(response.body.data.fraud.isFraud).toBe(true);
      expect(response.body.data.fraud.riskLevel).toBe('high');
    });

    it('should handle missing accountId with validation error', async () => {
      const response = await request(app)
        .post('/fraud/analyze')
        .send({
          amount: 100,
          currency: 'USD',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /fraud/alerts', () => {
    it('should return fraud alerts with pagination', async () => {
      const mockAlerts = {
        items: [
          {
            id: 'alert1',
            alertType: 'high_risk_transaction',
            details: 'Risk score: 85',
            resolved: false,
            createdAt: new Date('2024-01-01'),
            transactionId: 'tx123',
            accountId: 'acc123',
          },
          {
            id: 'alert2',
            alertType: 'suspicious_location',
            details: 'Risk score: 60',
            resolved: true,
            createdAt: new Date('2023-12-01'),
            accountId: 'acc456',
          },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      };

      (fraudDetectionService.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/fraud/alerts')
        .query({ limit: 20, offset: 0 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          items: mockAlerts.items,
          total: 2,
          limit: 20,
          offset: 0,
        },
      });

      expect(fraudDetectionService.getAlerts).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        resolved: undefined,
        alertType: undefined,
      });
    });

    it('should filter by resolved status', async () => {
      const mockAlerts = { items: [], total: 0, limit: 20, offset: 0 };
      (fraudDetectionService.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);

      await request(app)
        .get('/fraud/alerts')
        .query({ resolved: 'true' })
        .expect(200);

      expect(fraudDetectionService.getAlerts).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        resolved: true,
        alertType: undefined,
      });
    });

    it('should filter by alert type', async () => {
      const mockAlerts = { items: [], total: 0, limit: 20, offset: 0 };
      (fraudDetectionService.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);

      await request(app)
        .get('/fraud/alerts')
        .query({ alertType: 'high_risk_transaction' })
        .expect(200);

      expect(fraudDetectionService.getAlerts).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        resolved: undefined,
        alertType: 'high_risk_transaction',
      });
    });
  });

  describe('POST /fraud/alerts/:id/acknowledge', () => {
    it('should acknowledge a fraud alert successfully', async () => {
      const mockAlert = {
        id: 'alert1',
        alertType: 'high_risk_transaction',
        details: 'Risk score: 85\n\nAcknowledged: Reviewed by admin',
        resolved: true,
        createdAt: new Date('2024-01-01'),
        transactionId: 'tx123',
        accountId: 'acc123',
      };

      (fraudDetectionService.acknowledgeAlert as jest.Mock).mockResolvedValue(mockAlert);

      const response = await request(app)
        .post('/fraud/alerts/alert1/acknowledge')
        .send({ notes: 'Reviewed by admin' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'alert1',
          resolved: true,
        },
      });

      expect(fraudDetectionService.acknowledgeAlert).toHaveBeenCalledWith(
        'alert1',
        'Reviewed by admin'
      );
    });

    it('should acknowledge without notes', async () => {
      const mockAlert = {
        id: 'alert1',
        alertType: 'high_risk_transaction',
        details: 'Risk score: 85',
        resolved: true,
        createdAt: new Date('2024-01-01'),
      };

      (fraudDetectionService.acknowledgeAlert as jest.Mock).mockResolvedValue(mockAlert);

      await request(app)
        .post('/fraud/alerts/alert1/acknowledge')
        .send({})
        .expect(200);

      expect(fraudDetectionService.acknowledgeAlert).toHaveBeenCalledWith('alert1', undefined);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for analyze endpoint', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      });

      await request(app)
        .post('/fraud/analyze')
        .send({ accountId: 'acc123', amount: 100 })
        .expect(401);
    });

    it('should require authentication for alerts endpoint', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      });

      await request(app)
        .get('/fraud/alerts')
        .expect(401);
    });

    it('should require authentication for acknowledge endpoint', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      });

      await request(app)
        .post('/fraud/alerts/alert1/acknowledge')
        .send({})
        .expect(401);
    });
  });
});
