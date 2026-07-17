import { RedisCacheService, MemoryCacheService, MultiLevelCacheService } from '../cacheService';
import type { Redis as RedisClient } from 'ioredis';

describe('MemoryCacheService', () => {
  let memoryCache: MemoryCacheService;

  beforeEach(() => {
    memoryCache = new MemoryCacheService();
  });

  afterEach(() => {
    memoryCache.flushAll();
  });

  describe('get/set', () => {
    it('should store and retrieve a value', async () => {
      await memoryCache.set('test-key', { data: 'hello' });
      const result = await memoryCache.get('test-key');
      expect(result).toEqual({ data: 'hello' });
    });

    it('should return null for non-existent key', async () => {
      const result = await memoryCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      await memoryCache.set('ttl-key', 'value', { ttlSeconds: 1 });
      const result1 = await memoryCache.get('ttl-key');
      expect(result1).toBe('value');
      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 1100));
      const result2 = await memoryCache.get('ttl-key');
      expect(result2).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a cached value', async () => {
      await memoryCache.set('del-key', 'value');
      await memoryCache.del('del-key');
      const result = await memoryCache.get('del-key');
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      await memoryCache.set('exists-key', 'value');
      const exists = await memoryCache.exists('exists-key');
      expect(exists).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const exists = await memoryCache.exists('no-key');
      expect(exists).toBe(false);
    });
  });

  describe('incrBy', () => {
    it('should increment counter', async () => {
      const result = await memoryCache.incrBy('counter', 5);
      expect(result).toBe(5);
      const result2 = await memoryCache.incrBy('counter', 3);
      expect(result2).toBe(8);
    });
  });

  describe('expire', () => {
    it('should set expiration on existing key', async () => {
      await memoryCache.set('expire-key', 'value');
      const result = await memoryCache.expire('expire-key', 1);
      expect(result).toBe(true);
    });
  });
});

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
      smembers: jest.fn(),
      sadd: jest.fn(),
      pipeline: jest.fn(),
    } as any;

    // Mock pipeline
    (mockRedis as any).pipeline = jest.fn().mockReturnValue({
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

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

    it('should store tags in Redis SETs when provided', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('test-key', { data: 'test' }, {
        ttlSeconds: 3600,
        tags: ['user:123'],
      });

      expect(mockRedis.set).toHaveBeenCalled();
      // Pipeline should have been called for tag storage
      expect(mockRedis.pipeline).toHaveBeenCalled();
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

  describe('tag operations', () => {
    it('should get keys by tag', async () => {
      mockRedis.smembers.mockResolvedValue(['key1', 'key2']);

      const keys = await cacheService.getKeysByTag('user:123');
      expect(keys).toEqual(['key1', 'key2']);
    });

    it('should remove a tag', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cacheService.removeTag('user:123');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});

describe('MultiLevelCacheService', () => {
  let multiCache: MultiLevelCacheService;
  let memoryCache: MemoryCacheService;
  let mockRedis: jest.Mocked<RedisClient>;
  let redisCache: RedisCacheService;

  beforeEach(() => {
    memoryCache = new MemoryCacheService();
    memoryCache.flushAll();

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      incrby: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      sadd: jest.fn().mockResolvedValue(1),
      pipeline: jest.fn(),
    } as any;

    (mockRedis as any).pipeline = jest.fn().mockReturnValue({
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    redisCache = new RedisCacheService(mockRedis);
    multiCache = new MultiLevelCacheService(memoryCache, redisCache);
    multiCache.resetStats();
    multiCache.stopMonitoring();
  });

  describe('get (multi-level)', () => {
    it('should return from memory cache (L1) on hit', async () => {
      await memoryCache.set('multi-key', { data: 'from-memory' });

      const result = await multiCache.get('multi-key');
      expect(result).toEqual({ data: 'from-memory' });
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should fall through to Redis (L2) on L1 miss', async () => {
      const redisValue = { data: 'from-redis' };
      mockRedis.get.mockResolvedValue(JSON.stringify(redisValue));

      const result = await multiCache.get('multi-key');
      expect(result).toEqual(redisValue);
      expect(mockRedis.get).toHaveBeenCalledWith('multi-key');

      // It should also have populated L1
      const memValue = await memoryCache.get('multi-key');
      expect(memValue).toEqual(redisValue);
    });

    it('should return null on full miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await multiCache.get('no-key');
      expect(result).toBeNull();
    });

    it('should skip cache when skipCache option is true', async () => {
      await memoryCache.set('skip-key', 'cached');
      const result = await multiCache.get('skip-key', { skipCache: true });
      expect(result).toBeNull();
    });

    it('should skip memory cache when skipMemory option is true', async () => {
      await memoryCache.set('skip-mem-key', 'mem-value');
      const redisValue = { data: 'from-redis' };
      mockRedis.get.mockResolvedValue(JSON.stringify(redisValue));

      const result = await multiCache.get('skip-mem-key', { skipMemory: true });
      expect(result).toEqual(redisValue);
    });
  });

  describe('set (multi-level)', () => {
    it('should set in both L1 and L2', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await multiCache.set('multi-set', { data: 'test' }, { ttlSeconds: 300 });

      // Check L1
      const memVal = await memoryCache.get('multi-set');
      expect(memVal).toEqual({ data: 'test' });

      // Check L2 was called
      expect(mockRedis.set).toHaveBeenCalledWith(
        'multi-set',
        '{"data":"test"}',
        'EX',
        300
      );
    });

    it('should store tags in both L1 and L2', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await multiCache.set('tagged-key', 'value', {
        ttlSeconds: 300,
        tags: ['user:42'],
      });

      // Check memory tag index
      const memKeys = memoryCache.getKeysByTag('user:42');
      expect(memKeys).toContain('tagged-key');

      // Check Redis tag was stored via pipeline
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });
  });

  describe('stats tracking', () => {
    it('should track hits and misses', async () => {
      // Miss
      mockRedis.get.mockResolvedValue(null);
      await multiCache.get('miss-key');
      let stats = multiCache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Memory hit
      await memoryCache.set('hit-key', 'value');
      await multiCache.get('hit-key');
      stats = multiCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.memoryHits).toBe(1);
    });

    it('should track sets and deletes', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await multiCache.set('track-key', 'val');
      expect(multiCache.getStats().sets).toBe(1);

      await multiCache.del('track-key');
      expect(multiCache.getStats().deletes).toBe(1);
    });

    it('should reset stats', async () => {
      await multiCache.get('test');
      multiCache.resetStats();
      expect(multiCache.getStats().hits).toBe(0);
      expect(multiCache.getStats().misses).toBe(0);
    });
  });

  describe('tag invalidation', () => {
    it('should invalidate keys by tags', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.smembers.mockResolvedValue(['redis-key-1']);

      // Set keys with tags
      await multiCache.set('mem-key-1', 'val1', { tags: ['project:1'] });
      await multiCache.set('mem-key-2', 'val2', { tags: ['project:1'] });

      // Invalidate by tag
      await multiCache.invalidateByTags(['project:1']);

      // Check memory keys are gone
      const v1 = await memoryCache.get('mem-key-1');
      const v2 = await memoryCache.get('mem-key-2');
      expect(v1).toBeNull();
      expect(v2).toBeNull();
    });
  });

  describe('incrBy (multi-level)', () => {
    it('should increment via Redis and sync to memory', async () => {
      mockRedis.incrby.mockResolvedValue(10);

      const result = await multiCache.incrBy('counter', 10);
      expect(result).toBe(10);

      // Memory should also be synced
      const memVal = await memoryCache.get('counter');
      expect(memVal).toBe(10);
    });
  });
});
