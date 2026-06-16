import { ApiKeyService } from '../apiKeyService';
import { ApiKeyCreateInput, ApiKeyUpdateInput, ApiTier } from '../../models/ApiKey';

// Create a mock interface that matches PrismaClient structure
interface MockPrismaClient {
  apiKey: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
  };
  $queryRaw: jest.Mock;
}

// Mock the Prisma client and logger
const mockPrisma: MockPrismaClient = {
  apiKey: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('../../generated/prisma', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../../utils/logger');

// Mock the ApiKey model
jest.mock('../../models/ApiKey', () => ({
  ApiKey: {
    fromPrisma: jest.fn(),
  },
  ApiTier: {
    FREE: 'FREE',
    PRO: 'PRO',
    ENTERPRISE: 'ENTERPRISE',
  },
}));

// Import the mocked ApiKey after the mock is defined
import { ApiKey } from '../../models/ApiKey';
const mockApiKey = ApiKey as jest.Mocked<typeof ApiKey>;

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    apiKeyService = new ApiKeyService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('should generate a key and hash', () => {
      const generateApiKey = (apiKeyService as any).generateApiKey.bind(apiKeyService);
      const result = generateApiKey();

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('hash');
      expect(result.key).toMatch(/^ck_[a-f0-9]{64}$/);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.key).not.toBe(result.hash);
    });

    it('should generate unique keys', () => {
      const generateApiKey = (apiKeyService as any).generateApiKey.bind(apiKeyService);
      const result1 = generateApiKey();
      const result2 = generateApiKey();

      expect(result1.key).not.toBe(result2.key);
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('createApiKey', () => {
    const mockPrismaApiKey = {
      id: 'key-123',
      keyHash: 'hash-123',
      name: 'Test Key',
      tier: 'FREE',
      userId: 'user-123',
      allowedIps: JSON.stringify(['192.168.1.1']),
      allowedPaths: JSON.stringify(['/api/v1/*']),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      usageQuota: 1000,
      currentUsage: 0,
      usageResetAt: null,
    };

    it('should create an API key with minimal input', async () => {
      const input: ApiKeyCreateInput = {
        name: 'Test Key',
      };

      mockPrisma.apiKey.create.mockResolvedValue(mockPrismaApiKey);
      mockApiKey.fromPrisma.mockReturnValue(mockPrismaApiKey as any);

      const result = await apiKeyService.createApiKey(input);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Key',
          tier: 'FREE',
          keyHash: expect.any(String),
        }),
      });

      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('plainKey');
      expect(result.plainKey).toMatch(/^ck_[a-f0-9]{64}$/);
    });

    it('should create an API key with all input fields', async () => {
      const input: ApiKeyCreateInput = {
        name: 'Full Test Key',
        tier: 'PRO',
        userId: 'user-123',
        allowedIps: ['192.168.1.1', '10.0.0.1'],
        allowedPaths: ['/api/v1/*', '/api/v2/*'],
        expiresAt: new Date('2024-12-31'),
        usageQuota: 5000,
      };

      mockPrisma.apiKey.create.mockResolvedValue(mockPrismaApiKey);
      mockApiKey.fromPrisma.mockReturnValue(mockPrismaApiKey as any);

      const result = await apiKeyService.createApiKey(input);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Full Test Key',
          tier: 'PRO',
          userId: 'user-123',
          allowedIps: JSON.stringify(['192.168.1.1', '10.0.0.1']),
          allowedPaths: JSON.stringify(['/api/v1/*', '/api/v2/*']),
          expiresAt: new Date('2024-12-31'),
          usageQuota: 5000,
        }),
      });

      expect(result.apiKey).toBeDefined();
      expect(result.plainKey).toBeDefined();
    });

    it('should handle creation errors', async () => {
      const input: ApiKeyCreateInput = { name: 'Test Key' };
      mockPrisma.apiKey.create.mockRejectedValue(new Error('Database error'));

      await expect(apiKeyService.createApiKey(input))
        .rejects.toThrow('Failed to create API key');
    });
  });

  describe('validateApiKey', () => {
    const mockPrismaApiKey = {
      id: 'key-123',
      keyHash: 'hash-123',
      name: 'Test Key',
      tier: 'FREE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      usageQuota: 1000,
      currentUsage: 0,
      usageResetAt: null,
    };

    it('should validate a correct API key', async () => {
      const testKey = 'ck_test1234567890123456789012345678901234567890123456789012345678901234';
      const hash = require('crypto').createHash('sha256').update(testKey).digest('hex');

      mockPrisma.apiKey.findFirst.mockResolvedValue({
        ...mockPrismaApiKey,
        keyHash: hash,
      });

      const mockApiKeyInstance = {
        ...mockPrismaApiKey,
        isExpired: jest.fn().mockReturnValue(false),
      };
      mockApiKey.fromPrisma.mockReturnValue(mockApiKeyInstance as any);

      mockPrisma.apiKey.update.mockResolvedValue(mockPrismaApiKey);

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeDefined();
      expect(mockPrisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          keyHash: hash,
          isActive: true,
        },
      });

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should return null for invalid API key', async () => {
      const testKey = 'ck_invalidkey';
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeNull();
    });

    it('should return null for expired API key', async () => {
      const testKey = 'ck_test1234567890123456789012345678901234567890123456789012345678901234';
      const hash = require('crypto').createHash('sha256').update(testKey).digest('hex');

      mockPrisma.apiKey.findFirst.mockResolvedValue({
        ...mockPrismaApiKey,
        keyHash: hash,
      });

      const mockApiKeyInstance = {
        ...mockPrismaApiKey,
        isExpired: jest.fn().mockReturnValue(true),
      };
      mockApiKey.fromPrisma.mockReturnValue(mockApiKeyInstance as any);

      mockPrisma.apiKey.update.mockResolvedValue(mockPrismaApiKey);

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeNull();
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { isActive: false },
      });
    });

    it('should handle validation errors gracefully', async () => {
      const testKey = 'ck_test1234567890123456789012345678901234567890123456789012345678901234';
      mockPrisma.apiKey.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeNull();
    });
  });

  describe('getApiKeyById', () => {
    it('should return API key when found', async () => {
      const mockPrismaApiKey = {
        id: 'key-123',
        name: 'Test Key',
        tier: 'FREE',
      };

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockPrismaApiKey);
      mockApiKey.fromPrisma.mockReturnValue(mockPrismaApiKey as any);

      const result = await apiKeyService.getApiKeyById('key-123');

      expect(result).toBeDefined();
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await apiKeyService.getApiKeyById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockPrisma.apiKey.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(apiKeyService.getApiKeyById('key-123'))
        .rejects.toThrow('Failed to get API key');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key with provided fields', async () => {
      const input: ApiKeyUpdateInput = {
        name: 'Updated Name',
        tier: 'PRO',
        isActive: false,
      };

      const mockPrismaApiKey = {
        id: 'key-123',
        name: 'Updated Name',
        tier: 'PRO',
        isActive: false,
      };

      mockPrisma.apiKey.update.mockResolvedValue(mockPrismaApiKey);
      mockApiKey.fromPrisma.mockReturnValue(mockPrismaApiKey as any);

      const result = await apiKeyService.updateApiKey('key-123', input);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          name: 'Updated Name',
          tier: 'PRO',
          isActive: false,
        },
      });

      expect(result.name).toBe('Updated Name');
      expect(result.tier).toBe('PRO');
      expect(result.isActive).toBe(false);
    });

    it('should handle update errors', async () => {
      const input: ApiKeyUpdateInput = { name: 'Updated Name' };
      mockPrisma.apiKey.update.mockRejectedValue(new Error('Update failed'));

      await expect(apiKeyService.updateApiKey('key-123', input))
        .rejects.toThrow('Failed to update API key');
    });
  });

  describe('deactivateApiKey', () => {
    it('should deactivate API key', async () => {
      mockPrisma.apiKey.update.mockResolvedValue({});

      await apiKeyService.deactivateApiKey('key-123');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { isActive: false },
      });
    });

    it('should handle deactivation errors', async () => {
      mockPrisma.apiKey.update.mockRejectedValue(new Error('Deactivation failed'));

      await expect(apiKeyService.deactivateApiKey('key-123'))
        .rejects.toThrow('Failed to deactivate API key');
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key', async () => {
      mockPrisma.apiKey.delete.mockResolvedValue({});

      await apiKeyService.deleteApiKey('key-123');

      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });
    });

    it('should handle deletion errors', async () => {
      mockPrisma.apiKey.delete.mockRejectedValue(new Error('Deletion failed'));

      await expect(apiKeyService.deleteApiKey('key-123'))
        .rejects.toThrow('Failed to delete API key');
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage for valid API key', async () => {
      const mockApiKeyInstance = {
        id: 'key-123',
        needsQuotaReset: jest.fn().mockReturnValue(false),
      };

      jest.spyOn(apiKeyService, 'getApiKeyById').mockResolvedValue(mockApiKeyInstance as any);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await apiKeyService.incrementUsage('key-123');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          currentUsage: {
            increment: 1,
          },
        },
      });
    });

    it('should reset usage if needed', async () => {
      const mockApiKeyInstance = {
        id: 'key-123',
        needsQuotaReset: jest.fn().mockReturnValue(true),
      };

      jest.spyOn(apiKeyService, 'getApiKeyById').mockResolvedValue(mockApiKeyInstance as any);
      jest.spyOn(apiKeyService, 'resetUsage' as any).mockResolvedValue({});

      await apiKeyService.incrementUsage('key-123');

      expect(apiKeyService.resetUsage).toHaveBeenCalledWith('key-123');
    });

    it('should handle non-existent API key', async () => {
      jest.spyOn(apiKeyService, 'getApiKeyById').mockResolvedValue(null);

      await apiKeyService.incrementUsage('nonexistent');

      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should clean up expired keys', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 5 });

      const result = await apiKeyService.cleanupExpiredKeys();

      expect(result).toBe(5);
      expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lte: expect.any(Date),
          },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    });

    it('should handle cleanup errors', async () => {
      mockPrisma.apiKey.updateMany.mockRejectedValue(new Error('Cleanup failed'));

      await expect(apiKeyService.cleanupExpiredKeys())
        .rejects.toThrow('Failed to cleanup expired API keys');
    });
  });
});
