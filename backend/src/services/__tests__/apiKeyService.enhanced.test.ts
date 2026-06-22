import { ApiKeyService } from '../apiKeyService';
import { ApiKeyCreateInput, ApiKeyUpdateInput } from '../../models/ApiKey';
import { generateApiKey, verifyApiKey } from '../../utils/keyUtils';

// Mock keyUtils
jest.mock('../../utils/keyUtils', () => ({
  generateApiKey: jest.fn(),
  verifyApiKey: jest.fn(),
  maskApiKey: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('ApiKeyService Enhanced', () => {
  let apiKeyService: ApiKeyService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      }
    };
    apiKeyService = new ApiKeyService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create an API key with argon2 hashing', async () => {
      const input: ApiKeyCreateInput = {
        name: 'Elite Key',
        type: 'READ_WRITE',
        userId: 'user-1'
      };

      (generateApiKey as jest.Mock).mockResolvedValue({
        key: 'ak_live_test-public-id-test-key-secret',
        hash: '$argon2id$v=19$m=65536,t=3,p=4$encodedhash',
        prefix: 'ak_live_',
        publicId: 'test-public-id'
      });

      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        publicId: 'test-public-id',
        keyHash: '$argon2id$v=19$m=65536,t=3,p=4$encodedhash',
        name: 'Elite Key',
        prefix: 'ak_live_',
        type: 'READ_WRITE',
        status: 'ACTIVE',
        tier: 'FREE',
        userId: 'user-1',
        isActive: true,
        allowedIps: '[]',
        allowedPaths: '[]',
        permissions: '[]',
        scopes: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        lastUsedAt: null,
        usageQuota: null,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        rotatedFrom: null,
        usageResetAt: new Date()
      });

      const result = await apiKeyService.createApiKey(input);

      expect(generateApiKey).toHaveBeenCalledWith('ak_live_');
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATED',
          entityId: 'key-1'
        })
      }));
      expect(result.plainKey).toBe('ak_live_test-public-id-test-key-secret');
    });
  });

  describe('validateApiKey', () => {
    it('should validate an API key correctly using Argon2', async () => {
      const testKey = 'ak_live_abcdef123456_secret-part';
      
      mockPrisma.apiKey.findUnique.mockResolvedValue(
        {
          id: 'key-1',
          publicId: 'abcdef123456',
          keyHash: 'hash-1',
          prefix: 'ak_live_',
          type: 'READ_WRITE',
          status: 'ACTIVE',
          isActive: true,
          deletedAt: null,
          permissions: '[]',
          scopes: '[]',
          allowedIps: '[]',
          allowedPaths: '[]',
          tier: 'FREE',
          userId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: null,
          usageQuota: null,
          usageCount: 0,
          successCount:0,
          failureCount:0,
          rotatedFrom: null,
          usageResetAt: new Date(),
        }
      );

      (verifyApiKey as jest.Mock).mockResolvedValue(true);
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-1');
      expect(verifyApiKey).toHaveBeenCalledWith(testKey, 'hash-1');
    });

    it('should return null for invalid key', async () => {
      const testKey = 'ak_live_abcdef123456_invalid-key-secret';
      
      mockPrisma.apiKey.findUnique.mockResolvedValue(
        { 
          id: 'key-1',
          publicId: 'abcdef123456',
          keyHash: 'hash-1',
          prefix: 'ak_live_',
          status: 'ACTIVE',
          isActive: true,
          deletedAt: null,
          permissions: '[]',
          scopes: '[]',
          allowedIps: '[]',
          allowedPaths: '[]',
          tier: 'FREE',
          userId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
          lastUsedAt: null,
          usageQuota: null,
          usageCount:0,
          successCount:0,
          failureCount:0,
          rotatedFrom:null,
          usageResetAt: new Date()
        }
      );

      (verifyApiKey as jest.Mock).mockResolvedValue(false);

      const result = await apiKeyService.validateApiKey(testKey);

      expect(result).toBeNull();
    });
  });

  describe('rotateApiKey', () => {
    it('should revoke old key and create a new one', async () => {
      const oldKeyId = 'old-key-id';
      const oldKey = {
        id: oldKeyId,
        name: 'Old Key',
        tier: 'FREE',
        type: 'READ_WRITE',
        userId: 'user-1',
        allowedIps: [],
        allowedPaths: [],
        permissions: [],
        scopes: [],
        isActive: true,
        status: 'ACTIVE'
      };

      jest.spyOn(apiKeyService, 'getApiKeyById').mockResolvedValue(oldKey as any);
      
      const createSpy = jest.spyOn(apiKeyService, 'createApiKey').mockResolvedValue({
        apiKey: { id: 'new-key-id' } as any,
        plainKey: 'ak_live_newkey'
      });

      await apiKeyService.rotateApiKey(oldKeyId);

      expect(createSpy).toHaveBeenCalled();
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'old-key-id' },
        data: expect.objectContaining({ status: 'REVOKED' })
      }));
    });
  });
});
