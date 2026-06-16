import { UsageTrackingService, UsageRecord } from '../usageTrackingService';
import { Request } from 'express';

// Create a mock interface that matches PrismaClient structure
interface MockPrismaClient {
  apiUsage: {
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
    deleteMany: jest.Mock;
  };
  $queryRaw: jest.Mock;
}

// Mock Prisma client
const mockPrisma: MockPrismaClient = {
  apiUsage: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('../../generated/prisma', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../../utils/logger');

describe('UsageTrackingService', () => {
  let usageService: UsageTrackingService;

  beforeEach(() => {
    usageService = new UsageTrackingService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    it('should record usage successfully', async () => {
      const record: UsageRecord = {
        apiKeyId: 'key-123',
        endpoint: '/api/v1/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        requestSize: 100,
        responseSize: 500,
        ip: '192.168.1.1',
        userAgent: 'test-agent',
      };

      mockPrisma.apiUsage.create.mockResolvedValue({});

      await usageService.recordUsage(record);

      expect(mockPrisma.apiUsage.create).toHaveBeenCalledWith({
        data: {
          apiKeyId: 'key-123',
          endpoint: '/api/v1/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 150,
          requestSize: 100,
          responseSize: 500,
          ip: '192.168.1.1',
          userAgent: 'test-agent',
        },
      });
    });

    it('should handle recording errors gracefully', async () => {
      const record: UsageRecord = {
        apiKeyId: 'key-123',
        endpoint: '/api/v1/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        requestSize: 100,
        responseSize: 500,
        ip: '192.168.1.1',
      };

      mockPrisma.apiUsage.create.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(usageService.recordUsage(record)).resolves.toBeUndefined();
    });
  });

  describe('extractUsageFromRequest', () => {
    it('should extract usage from Express request', () => {
      const mockRequest: Partial<Request> = {
        path: '/api/v1/users',
        method: 'POST',
        body: { name: 'John', email: 'john@example.com' },
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      };

      const result = usageService.extractUsageFromRequest(
        mockRequest as Request,
        'key-123',
        150, // responseTime
        200, // statusCode
        500  // responseSize
      );

      expect(result).toEqual({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/users',
        method: 'POST',
        statusCode: 200,
        responseTime: 150,
        requestSize: JSON.stringify({ name: 'John', email: 'john@example.com' }).length,
        responseSize: 500,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle missing request properties', () => {
      const mockRequest: Partial<Request> = {
        path: '/api/v1/test',
        method: 'GET',
        body: null,
        headers: {},
        connection: {} as any,
      };

      const result = usageService.extractUsageFromRequest(
        mockRequest as Request,
        'key-123',
        50,  // responseTime
        404, // statusCode
        100  // responseSize
      );

      expect(result).toEqual({
        apiKeyId: 'key-123',
        endpoint: '/api/v1/test',
        method: 'GET',
        statusCode: 404,
        responseTime: 50,
        requestSize: 4, // JSON.stringify(null).length
        responseSize: 100,
        ip: 'unknown',
        userAgent: undefined,
      });
    });
  });

  describe('getAnalytics', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should return analytics data', async () => {
      mockPrisma.apiUsage.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(950);
      
      mockPrisma.apiUsage.findMany.mockResolvedValue([
        { apiKeyId: 'key-1' },
        { apiKeyId: 'key-2' },
      ]);
      
      mockPrisma.apiUsage.aggregate.mockResolvedValue({
        _avg: { responseTime: 150 },
      });
      
      mockPrisma.apiUsage.groupBy
        .mockResolvedValueOnce([
          { endpoint: '/api/v1/users', _count: 500, _avg: { responseTime: 120 } },
          { endpoint: '/api/v1/orders', _count: 300, _avg: { responseTime: 180 } },
        ])
        .mockResolvedValueOnce([
          { statusCode: 200, _count: 950 },
          { statusCode: 404, _count: 30 },
          { statusCode: 500, _count: 20 },
        ]);
      
      mockPrisma.$queryRaw.mockResolvedValue([
        { hour: '2024-01-01 10:00:00', requests: 50 },
        { hour: '2024-01-01 11:00:00', requests: 75 },
      ]);

      // Mock private getTierDistribution method
      jest.spyOn(usageService as any, 'getTierDistribution').mockResolvedValue({
        FREE: 600,
        PRO: 300,
        ENTERPRISE: 100,
      });

      const result = await usageService.getAnalytics(startDate, endDate);

      expect(result).toEqual({
        totalRequests: 1000,
        uniqueApiKeys: 2,
        averageResponseTime: 150,
        successRate: 95,
        errorRate: 5,
        topEndpoints: [
          { endpoint: '/api/v1/users', count: 500, avgResponseTime: 120 },
          { endpoint: '/api/v1/orders', count: 300, avgResponseTime: 180 },
        ],
        hourlyStats: [
          { hour: '2024-01-01 10:00:00', requests: 50 },
          { hour: '2024-01-01 11:00:00', requests: 75 },
        ],
        statusDistribution: {
          '200': 950,
          '404': 30,
          '500': 20,
        },
        tierDistribution: {
          FREE: 600,
          PRO: 300,
          ENTERPRISE: 100,
        },
      });
    });

    it('should handle analytics errors', async () => {
      mockPrisma.apiUsage.count.mockRejectedValue(new Error('Database error'));

      await expect(usageService.getAnalytics(startDate, endDate))
        .rejects.toThrow('Failed to get analytics');
    });
  });

  describe('getApiKeyUsage', () => {
    it('should return API key usage data', async () => {
      mockPrisma.apiUsage.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(95);
      
      mockPrisma.apiUsage.aggregate.mockResolvedValue({
        _avg: { responseTime: 120 },
      });
      
      mockPrisma.apiUsage.groupBy
        .mockResolvedValueOnce([
          { endpoint: '/api/v1/users', _count: 60, _avg: { responseTime: 100 } },
          { endpoint: '/api/v1/orders', _count: 40, _avg: { responseTime: 150 } },
        ]);
      
      mockPrisma.$queryRaw.mockResolvedValue([
        { date: '2024-01-01', requests: 20 },
        { date: '2024-01-02', requests: 30 },
      ]);

      const result = await usageService.getApiKeyUsage('key-123');

      expect(result).toEqual({
        totalRequests: 100,
        averageResponseTime: 120,
        successRate: 95,
        endpointBreakdown: [
          { endpoint: '/api/v1/users', count: 60, avgResponseTime: 100 },
          { endpoint: '/api/v1/orders', count: 40, avgResponseTime: 150 },
        ],
        dailyUsage: [
          { date: '2024-01-01', requests: 20 },
          { date: '2024-01-02', requests: 30 },
        ],
      });
    });

    it('should handle API key usage errors', async () => {
      mockPrisma.apiUsage.count.mockRejectedValue(new Error('Database error'));

      await expect(usageService.getApiKeyUsage('key-123'))
        .rejects.toThrow('Failed to get API key usage');
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return real-time metrics', async () => {
      mockPrisma.apiUsage.count
        .mockResolvedValueOnce(50)  // requestsLastMinute
        .mockResolvedValueOnce(3000) // requestsLastHour
        .mockResolvedValueOnce(45);  // errorCount

      mockPrisma.apiUsage.findMany.mockResolvedValue([
        { apiKeyId: 'key-1' },
        { apiKeyId: 'key-2' },
        { apiKeyId: 'key-3' },
      ]);

      mockPrisma.apiUsage.aggregate.mockResolvedValue({
        _avg: { responseTime: 140 },
        _count: 50,
      });

      const result = await usageService.getRealTimeMetrics();

      expect(result).toEqual({
        requestsLastMinute: 50,
        requestsLastHour: 3000,
        activeApiKeys: 3,
        averageResponseTime: 140,
        errorRate: 90, // (45/50) * 100
      });
    });

    it('should handle real-time metrics errors', async () => {
      mockPrisma.apiUsage.count.mockRejectedValue(new Error('Database error'));

      await expect(usageService.getRealTimeMetrics())
        .rejects.toThrow('Failed to get real-time metrics');
    });
  });

  describe('cleanupOldUsage', () => {
    it('should clean up old usage records', async () => {
      mockPrisma.apiUsage.deleteMany.mockResolvedValue({ count: 1000 });

      const result = await usageService.cleanupOldUsage(90);

      expect(result).toBe(1000);
      expect(mockPrisma.apiUsage.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should use default retention period', async () => {
      mockPrisma.apiUsage.deleteMany.mockResolvedValue({ count: 500 });

      await usageService.cleanupOldUsage();

      expect(mockPrisma.apiUsage.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should handle cleanup errors', async () => {
      mockPrisma.apiUsage.deleteMany.mockRejectedValue(new Error('Cleanup failed'));

      await expect(usageService.cleanupOldUsage())
        .rejects.toThrow('Failed to cleanup old usage records');
    });
  });

  describe('exportUsageData', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should export usage data for billing', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          apiKeyId: 'key-1',
          apiKeyName: 'Test Key',
          tier: 'PRO',
          totalRequests: 1000,
          billableRequests: 1000,
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
        },
      ]);

      const result = await usageService.exportUsageData(startDate, endDate);

      expect(result).toEqual([
        {
          apiKeyId: 'key-1',
          apiKeyName: 'Test Key',
          tier: 'PRO',
          totalRequests: 1000,
          billableRequests: 1000,
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
        },
      ]);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const callArgs = mockPrisma.$queryRaw.mock.calls[0];
      const sqlParts = callArgs[0];
      expect(sqlParts.join('')).toContain('JOIN api_keys ak ON au.api_key_id = ak.id');
    });

    it('should handle export errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Export failed'));

      await expect(usageService.exportUsageData(startDate, endDate))
        .rejects.toThrow('Failed to export usage data');
    });
  });

  describe('getTierDistribution (private method)', () => {
    it('should return tier distribution', async () => {
      const whereClause = {
        timestamp: {
          gte: new Date('2024-01-01'),
          lte: new Date('2024-01-31'),
        },
      };

      mockPrisma.$queryRaw.mockResolvedValue([
        { tier: 'FREE', count: 100 },
        { tier: 'PRO', count: 50 },
        { tier: 'ENTERPRISE', count: 10 },
      ]);

      const getTierDistribution = (usageService as any).getTierDistribution.bind(usageService);
      const result = await getTierDistribution(whereClause);

      expect(result).toEqual({
        FREE: 100,
        PRO: 50,
        ENTERPRISE: 10,
      });
    });

    it('should handle tier distribution errors gracefully', async () => {
      const whereClause = { timestamp: {} };
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Query failed'));

      const getTierDistribution = (usageService as any).getTierDistribution.bind(usageService);
      const result = await getTierDistribution(whereClause);

      expect(result).toEqual({});
    });
  });
});
