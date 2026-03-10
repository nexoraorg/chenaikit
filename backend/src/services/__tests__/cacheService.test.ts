import { RedisCacheService } from '../cacheService';
import type { Redis as RedisClient } from 'ioredis';

describe('RedisCacheService', () => {
  let cacheService: RedisCacheService;
  let mockRedis: jest.Mocked<RedisClient>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      incrby: jest.fn(),
    } as any;

    cacheService = new RedisCacheService(mockRedis);
  });

  describe('get', () => {
    it('should retrieve cached value', async () => {
      const mockValue = { data: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockValue));

      const result = await cacheService.get('test-key');
      expect(result).toEqual(mockValue);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle string values', async () => {
      mockRedis.get.mockResolvedValue('simple-string');

      const result = await cacheService.get('test-key');
      expect(result).toBe('simple-string');
    });
  });

  describe('set', () => {
    it('should cache value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('test-key', { data: 'test' });
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', '{"data":"test"}');
    });

    it('should cache value with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('test-key', { data: 'test' }, { ttlSeconds: 3600 });
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', '{"data":"test"}', 'EX', 3600);
    });
  });

  describe('del', () => {
    it('should delete cached value', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cacheService.del('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists('test-key');
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.exists('test-key');
      expect(result).toBe(false);
    });
  });

  describe('incrBy', () => {
    it('should increment counter', async () => {
      mockRedis.incrby.mockResolvedValue(5);

      const result = await cacheService.incrBy('counter', 5);
      expect(result).toBe(5);
      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 5);
    });
  });

  describe('expire', () => {
    it('should set expiration on key', async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await cacheService.expire('test-key', 3600);
      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('test-key', 3600);
    });
  });
});
