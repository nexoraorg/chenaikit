import request from 'supertest';
import express from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { UsageTrackingService } from '../services/usageTrackingService';

// Mock services
jest.mock('../services/apiKeyService');
jest.mock('../services/usageTrackingService');

const mockApiKeyService = ApiKeyService as jest.MockedClass<typeof ApiKeyService>;
const mockUsageService = UsageTrackingService as jest.MockedClass<typeof UsageTrackingService>;

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Import and use routes
    require('../routes/api')(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key Management', () => {
    describe('POST /api/v1/keys', () => {
      it('should create a new API key', async () => {
        const mockApiKey = {
          id: 'key-123',
          name: 'Test Key',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          currentUsage: 0,
          usageResetAt: new Date(),
        };
        
        mockApiKeyService.prototype.createApiKey.mockResolvedValue({
          apiKey: mockApiKey as any,
          plainKey: 'ck_test123...'
        });

        const response = await request(app)
          .post('/api/v1/keys')
          .send({
            name: 'Test Key',
            tier: 'FREE'
          })
          .expect(201);

        expect(response.body).toEqual({
          apiKey: mockApiKey,
          plainKey: 'ck_test123...'
        });
        expect(mockApiKeyService.prototype.createApiKey).toHaveBeenCalledWith({
          name: 'Test Key',
          tier: 'FREE'
        });
      });

      it('should return 400 for invalid input', async () => {
        mockApiKeyService.prototype.createApiKey.mockRejectedValue(
          new Error('Invalid input')
        );

        await request(app)
          .post('/api/v1/keys')
          .send({
            name: '',
            tier: 'INVALID'
          })
          .expect(400);
      });
    });

    describe('GET /api/v1/keys/:id', () => {
      it('should return API key by ID', async () => {
        const mockApiKey = {
          id: 'key-123',
          name: 'Test Key',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          currentUsage: 0,
          usageResetAt: new Date(),
        };

        mockApiKeyService.prototype.getApiKeyById.mockResolvedValue(mockApiKey as any);

        const response = await request(app)
          .get('/api/v1/keys/key-123')
          .expect(200);

        expect(response.body).toEqual(mockApiKey);
        expect(mockApiKeyService.prototype.getApiKeyById).toHaveBeenCalledWith('key-123');
      });

      it('should return 404 for non-existent key', async () => {
        mockApiKeyService.prototype.getApiKeyById.mockResolvedValue(null);

        await request(app)
          .get('/api/v1/keys/nonexistent')
          .expect(404);
      });
    });
  });

  describe('Usage Tracking', () => {
    describe('GET /api/v1/analytics', () => {
      it('should return usage analytics', async () => {
        const mockAnalytics = {
          totalRequests: 1000,
          uniqueApiKeys: 50,
          averageResponseTime: 150,
          successRate: 95,
          errorRate: 5,
          topEndpoints: [
            { endpoint: '/api/v1/test', count: 100, avgResponseTime: 120 }
          ],
          hourlyStats: [
            { hour: '2024-01-01 10:00:00', requests: 50 }
          ],
          statusDistribution: { '200': 950, '404': 30, '500': 20 },
          tierDistribution: { FREE: 600, PRO: 300, ENTERPRISE: 100 }
        };

        mockUsageService.prototype.getAnalytics.mockResolvedValue(mockAnalytics);

        const response = await request(app)
          .get('/api/v1/analytics')
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          })
          .expect(200);

        expect(response.body).toEqual(mockAnalytics);
        expect(mockUsageService.prototype.getAnalytics).toHaveBeenCalledWith(
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );
      });

      it('should return 400 for invalid date range', async () => {
        mockUsageService.prototype.getAnalytics.mockRejectedValue(
          new Error('Invalid date range')
        );

        await request(app)
          .get('/api/v1/analytics')
          .query({
            startDate: 'invalid-date',
            endDate: '2024-01-31'
          })
          .expect(400);
      });
    });

    describe('GET /api/v1/keys/:id/usage', () => {
      it('should return API key usage', async () => {
        const mockUsage = {
          totalRequests: 100,
          averageResponseTime: 120,
          successRate: 95,
          endpointBreakdown: [
            { endpoint: '/api/v1/test', count: 60, avgResponseTime: 100 }
          ],
          dailyUsage: [
            { date: '2024-01-01', requests: 20 }
          ]
        };

        mockUsageService.prototype.getApiKeyUsage.mockResolvedValue(mockUsage);

        const response = await request(app)
          .get('/api/v1/keys/key-123/usage')
          .expect(200);

        expect(response.body).toEqual(mockUsage);
        expect(mockUsageService.prototype.getApiKeyUsage).toHaveBeenCalledWith('key-123');
      });
    });
  });

  describe('Authentication & Authorization', () => {
    describe('API Key Validation', () => {
      it('should allow requests with valid API key', async () => {
        const mockApiKey = {
          id: 'key-123',
          name: 'Test Key',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          currentUsage: 0,
          usageResetAt: new Date(),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);

        await request(app)
          .get('/api/v1/protected')
          .set('X-API-Key', 'valid-api-key')
          .expect(200);

        expect(mockApiKeyService.prototype.validateApiKey).toHaveBeenCalledWith('valid-api-key');
      });

      it('should reject requests with invalid API key', async () => {
        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(null);

        await request(app)
          .get('/api/v1/protected')
          .set('X-API-Key', 'invalid-api-key')
          .expect(401);

        expect(mockApiKeyService.prototype.validateApiKey).toHaveBeenCalledWith('invalid-api-key');
      });

      it('should reject requests without API key', async () => {
        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(null);

        await request(app)
          .get('/api/v1/protected')
          .expect(401);
      });
    });

    describe('Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        const mockApiKey = {
          id: 'key-123',
          name: 'Test Key',
          tier: 'PRO',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          currentUsage: 0,
          usageResetAt: new Date(),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);
        mockUsageService.prototype.recordUsage.mockResolvedValue();

        await request(app)
          .get('/api/v1/test')
          .set('X-API-Key', 'valid-api-key')
          .expect(200);

        expect(mockUsageService.prototype.recordUsage).toHaveBeenCalled();
      });

      it('should reject requests exceeding rate limit', async () => {
        const mockApiKey = {
          id: 'key-123',
          name: 'Test Key',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          currentUsage: 0,
          usageResetAt: new Date(),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);
        
        // Mock rate limit exceeded
        await request(app)
          .get('/api/v1/test')
          .set('X-API-Key', 'valid-api-key')
          .expect(429);

        expect(mockApiKeyService.prototype.validateApiKey).toHaveBeenCalledWith('valid-api-key');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for internal server errors', async () => {
      mockApiKeyService.prototype.createApiKey.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/v1/keys')
        .send({
          name: 'Test Key',
          tier: 'FREE'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Internal server error');
    });

    it('should return proper error format', async () => {
      mockApiKeyService.prototype.getApiKeyById.mockRejectedValue(
        new Error('Key not found')
      );

      const response = await request(app)
        .get('/api/v1/keys/invalid-key')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Key not found',
        timestamp: expect.any(String),
        path: '/api/v1/keys/invalid-key'
      });
    });
  });

  describe('Request/Response Validation', () => {
    it('should validate request body schema', async () => {
      await request(app)
        .post('/api/v1/keys')
        .send({
          // Missing required 'name' field
          tier: 'FREE'
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error');
          expect(res.body.error).toContain('name is required');
        });
    });

    it('should sanitize response data', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        tier: 'FREE',
        keyHash: 'hash123',
        userId: null,
        isActive: true,
        allowedIps: [],
        allowedPaths: [],
        createdAt: new Date(),
        expiresAt: null,
        lastUsedAt: new Date(),
        usageQuota: null,
        currentUsage: 0,
        usageResetAt: new Date(),
        // Internal fields that should not be exposed
        internalSecret: 'secret-value',
        sensitiveData: 'sensitive-value'
      };

      mockApiKeyService.prototype.getApiKeyById.mockResolvedValue(mockApiKey as any);

      const response = await request(app)
        .get('/api/v1/keys/key-123')
        .expect(200);

      expect(response.body).toEqual({
        id: 'key-123',
        name: 'Test Key',
        tier: 'FREE'
      });
      expect(response.body).not.toHaveProperty('internalSecret');
      expect(response.body).not.toHaveProperty('sensitiveData');
    });
  });
});
