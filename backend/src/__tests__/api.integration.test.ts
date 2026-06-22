import request from 'supertest';
import express from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { UsageTrackingService } from '../services/usageTrackingService';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import v1Router from '../routes/v1';
import v2Router from '../routes/v2';
import apiKeysRouter from '../routes/apiKeys';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';

// Mock services
jest.mock('../services/apiKeyService');
jest.mock('../services/usageTrackingService');
jest.mock('../config/redis', () => ({
  createRedisClient: jest.fn(() => ({
    incr: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(true),
    pttl: jest.fn().mockResolvedValue(1000)
  }))
}));

const mockApiKeyService = ApiKeyService as jest.MockedClass<typeof ApiKeyService>;
const mockUsageService = UsageTrackingService as jest.MockedClass<typeof UsageTrackingService>;

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Add test endpoints for integration tests
    const testRouter = express.Router();

    testRouter.get('/protected', apiKeyAuth, async (req, res) => {
      // Test endpoint to check apiKeyAuth middleware
      res.json({ message: 'protected' });
    });

    testRouter.get('/test', apiKeyAuth, async (req, res) => {
      // Test endpoint for rate limiting
      res.json({ message: 'ok' });
    });

    // Redirect old /api/v1/keys* to /api/v1/api-keys* for testing compatibility
    testRouter.use('/keys', (req, res, next) => {
      req.url = '/api-keys' + req.url;
      next('route');
    });

    // Mount routers
    app.use('/api/v1', testRouter, v1Router);
    app.use('/api/v1/keys', apiKeysRouter);
    app.use('/api/v2', v2Router);

    // Error handlers
    app.use('*', notFoundHandler);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key Management', () => {
    describe('POST /api/v1/api-keys', () => {
      it('should create a new API key', async () => {
        const mockApiKey = {
          id: 'key-123',
          publicId: 'pub-123',
          name: 'Test Key',
          prefix: 'ak_live_',
          type: 'READ_WRITE',
          status: 'ACTIVE',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          permissions: [],
          scopes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          usageCount: 0,
          successCount: 0,
          failureCount: 0,
          rotatedFrom: null,
          usageResetAt: new Date(),
        };
        
        mockApiKeyService.prototype.createApiKey.mockResolvedValue({
          apiKey: mockApiKey as any,
          plainKey: 'ak_live_pub-123_secret'
        });

        const response = await request(app)
          .post('/api/v1/api-keys')
          .send({
            name: 'Test Key',
            tier: 'FREE'
          })
          .expect(201);

        expect(response.body.data.apiKey.id).toBe(mockApiKey.id);
        expect(response.body.data.plainKey).toBe('ak_live_pub-123_secret');
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

        mockUsageService.prototype.getAnalytics = jest.fn().mockResolvedValue(mockAnalytics);

        const response = await request(app)
          .get('/api/v1/analytics')
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          totalRequests: expect.any(Number),
          uniqueApiKeys: expect.any(Number),
        });
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
          publicId: 'abc123',
          name: 'Test Key',
          prefix: 'ak_live_',
          type: 'READ_WRITE',
          status: 'ACTIVE',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          permissions: [],
          scopes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          usageCount: 0,
          successCount: 0,
          failureCount: 0,
          rotatedFrom: null,
          usageResetAt: new Date(),
          isExpired: jest.fn().mockReturnValue(false),
          isRevoked: jest.fn().mockReturnValue(false),
          isActiveStatus: jest.fn().mockReturnValue(true),
          isIpAllowed: jest.fn().mockReturnValue(true),
          isPathAllowed: jest.fn().mockReturnValue(true),
          hasScope: jest.fn().mockReturnValue(true),
          hasPermission: jest.fn().mockReturnValue(true),
          hasQuotaExceeded: jest.fn().mockReturnValue(false),
          needsQuotaReset: jest.fn().mockReturnValue(false),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);
        mockApiKeyService.prototype.recordUsage.mockResolvedValue(undefined);

        const response = await request(app)
          .get('/api/v1/protected')
          .set('X-API-Key', 'ak_live_abc123_def456')
          .expect(200);

        expect(mockApiKeyService.prototype.validateApiKey).toHaveBeenCalledWith('ak_live_abc123_def456');
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
          publicId: 'abc123',
          name: 'Test Key',
          prefix: 'ak_live_',
          type: 'READ_WRITE',
          status: 'ACTIVE',
          tier: 'PRO',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          permissions: [],
          scopes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          usageCount: 0,
          successCount: 0,
          failureCount: 0,
          rotatedFrom: null,
          usageResetAt: new Date(),
          isExpired: jest.fn().mockReturnValue(false),
          isRevoked: jest.fn().mockReturnValue(false),
          isActiveStatus: jest.fn().mockReturnValue(true),
          isIpAllowed: jest.fn().mockReturnValue(true),
          isPathAllowed: jest.fn().mockReturnValue(true),
          hasScope: jest.fn().mockReturnValue(true),
          hasPermission: jest.fn().mockReturnValue(true),
          hasQuotaExceeded: jest.fn().mockReturnValue(false),
          needsQuotaReset: jest.fn().mockReturnValue(false),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);
        mockUsageService.prototype.recordUsage.mockResolvedValue(undefined);

        await request(app)
          .get('/api/v1/test')
          .set('X-API-Key', 'ak_live_abc123_def456')
          .expect(200);

        expect(mockUsageService.prototype.recordUsage).toHaveBeenCalled();
      });

      it('should reject requests exceeding rate limit', async () => {
        const mockRedis = require('../config/redis').createRedisClient();
        mockRedis.incr.mockResolvedValue(101); // Free tier limit is 100
        const mockApiKey = {
          id: 'key-123',
          publicId: 'abc123',
          name: 'Test Key',
          prefix: 'ak_live_',
          type: 'READ_WRITE',
          status: 'ACTIVE',
          tier: 'FREE',
          keyHash: 'hash123',
          userId: null,
          isActive: true,
          allowedIps: [],
          allowedPaths: [],
          permissions: [],
          scopes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: new Date(),
          usageQuota: null,
          usageCount: 0,
          successCount: 0,
          failureCount: 0,
          rotatedFrom: null,
          usageResetAt: new Date(),
          isExpired: jest.fn().mockReturnValue(false),
          isRevoked: jest.fn().mockReturnValue(false),
          isActiveStatus: jest.fn().mockReturnValue(true),
          isIpAllowed: jest.fn().mockReturnValue(true),
          isPathAllowed: jest.fn().mockReturnValue(true),
          hasScope: jest.fn().mockReturnValue(true),
          hasPermission: jest.fn().mockReturnValue(true),
          hasQuotaExceeded: jest.fn().mockReturnValue(false),
          needsQuotaReset: jest.fn().mockReturnValue(false),
        };

        mockApiKeyService.prototype.validateApiKey.mockResolvedValue(mockApiKey as any);
        mockApiKeyService.prototype.recordUsage.mockResolvedValue(undefined);
        
        // Mock rate limit exceeded
        await request(app)
          .get('/api/v1/test')
          .set('X-API-Key', 'ak_live_abc123_def456')
          .expect(429);

        expect(mockApiKeyService.prototype.validateApiKey).toHaveBeenCalledWith('ak_live_abc123_def456');
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
