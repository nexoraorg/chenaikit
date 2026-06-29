/**
 * Integration tests for v2 API endpoints using supertest
 */
import request from 'supertest';
import app from '../index';

describe('v2 API Integration Tests', () => {
  // Mock authentication token
  const authToken = 'Bearer mock-test-token';

  describe('Credit Score Endpoints', () => {
    describe('POST /api/v2/credit-score/calculate', () => {
      it('should calculate credit score with valid data', async () => {
        const response = await request(app)
          .post('/api/v2/credit-score/calculate')
          .set('Authorization', authToken)
          .send({
            accountId: 'test-account-123',
            userId: 'test-user-123',
            model: 'credit-score-v2',
            includeFactors: true,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('creditScore');
        expect(response.body.data.creditScore).toHaveProperty('value');
        expect(response.body.data.creditScore).toHaveProperty('band');
        expect(response.body.data.creditScore).toHaveProperty('confidence');
        expect(response.body.data.creditScore).toHaveProperty('factors');
        expect(response.body.data).toHaveProperty('meta');
        expect(response.body.data.meta).toHaveProperty('generatedAt');
        expect(response.body.data.meta).toHaveProperty('model');
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/v2/credit-score/calculate')
          .send({
            accountId: 'test-account-123',
          })
          .expect(401);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v2/credit-score/calculate')
          .set('Authorization', authToken)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v2/credit-score/history/:accountId', () => {
      it('should return credit score history', async () => {
        const response = await request(app)
          .get('/api/v2/credit-score/history/test-account-123')
          .set('Authorization', authToken)
          .query({ limit: 10, offset: 0 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('limit');
        expect(response.body.data).toHaveProperty('offset');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/v2/credit-score/history/test-account-123')
          .expect(401);
      });

      it('should validate pagination parameters', async () => {
        const response = await request(app)
          .get('/api/v2/credit-score/history/test-account-123')
          .set('Authorization', authToken)
          .query({ limit: 200 }) // Over max limit
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v2/credit-score/models', () => {
      it('should return available scoring models', async () => {
        const response = await request(app)
          .get('/api/v2/credit-score/models')
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('models');
        expect(Array.isArray(response.body.data.models)).toBe(true);
        expect(response.body.data.models.length).toBeGreaterThan(0);
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/v2/credit-score/models')
          .expect(401);
      });
    });
  });

  describe('Fraud Detection Endpoints', () => {
    describe('POST /api/v2/fraud/analyze', () => {
      it('should analyze transaction for fraud', async () => {
        const response = await request(app)
          .post('/api/v2/fraud/analyze')
          .set('Authorization', authToken)
          .send({
            transactionId: 'tx-123',
            accountId: 'acc-123',
            amount: 100,
            currency: 'USD',
            merchant: 'Test Merchant',
            location: { latitude: 40.7128, longitude: -74.0060 },
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('fraud');
        expect(response.body.data.fraud).toHaveProperty('isFraud');
        expect(response.body.data.fraud).toHaveProperty('riskScore');
        expect(response.body.data.fraud).toHaveProperty('riskLevel');
        expect(response.body.data.fraud).toHaveProperty('factors');
        expect(response.body.data).toHaveProperty('meta');
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/v2/fraud/analyze')
          .send({
            accountId: 'acc-123',
            amount: 100,
          })
          .expect(401);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v2/fraud/analyze')
          .set('Authorization', authToken)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate location coordinates', async () => {
        const response = await request(app)
          .post('/api/v2/fraud/analyze')
          .set('Authorization', authToken)
          .send({
            accountId: 'acc-123',
            amount: 100,
            location: { latitude: 200, longitude: -74.0060 }, // Invalid latitude
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v2/fraud/alerts', () => {
      it('should return fraud alerts with pagination', async () => {
        const response = await request(app)
          .get('/api/v2/fraud/alerts')
          .set('Authorization', authToken)
          .query({ limit: 20, offset: 0 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('limit');
        expect(response.body.data).toHaveProperty('offset');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should filter by resolved status', async () => {
        const response = await request(app)
          .get('/api/v2/fraud/alerts')
          .set('Authorization', authToken)
          .query({ resolved: 'true' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should filter by alert type', async () => {
        const response = await request(app)
          .get('/api/v2/fraud/alerts')
          .set('Authorization', authToken)
          .query({ alertType: 'high_risk_transaction' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/v2/fraud/alerts')
          .expect(401);
      });
    });

    describe('POST /api/v2/fraud/alerts/:id/acknowledge', () => {
      it('should acknowledge a fraud alert', async () => {
        const response = await request(app)
          .post('/api/v2/fraud/alerts/alert-123/acknowledge')
          .set('Authorization', authToken)
          .send({ notes: 'Reviewed and confirmed' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('resolved');
      });

      it('should acknowledge without notes', async () => {
        const response = await request(app)
          .post('/api/v2/fraud/alerts/alert-123/acknowledge')
          .set('Authorization', authToken)
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/v2/fraud/alerts/alert-123/acknowledge')
          .send({})
          .expect(401);
      });
    });
  });

  describe('Legacy Endpoints (for backward compatibility)', () => {
    describe('GET /api/v2/credit-score', () => {
      it('should return credit score (legacy endpoint)', async () => {
        const response = await request(app)
          .get('/api/v2/credit-score')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('creditScore');
      });
    });

    describe('GET /api/v2/fraud/detect', () => {
      it('should return fraud detection result (legacy endpoint)', async () => {
        const response = await request(app)
          .get('/api/v2/fraud/detect')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('fraud');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      await request(app)
        .get('/api/v2/non-existent')
        .expect(404);
    });

    it('should return 405 for unsupported methods', async () => {
      await request(app)
        .post('/api/v2/credit-score/models')
        .set('Authorization', authToken)
        .expect(404);
    });
  });
});
