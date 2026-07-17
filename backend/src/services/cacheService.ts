import type { Redis as RedisClient } from 'ioredis';
import NodeCache from 'node-cache';
import { ensureRedisConnection } from '../config/redis';
import { cacheConfig } from '../config/cache';
import {
  serializeValue,
  safeJsonParse,
  buildTagKey,
  hashKey,
  withRetry,
  buildWarmingKey,
} from '../utils/cacheUtils';
import type {
  CacheService,
  CacheValue,
  CacheGetOptions,
  CacheSetOptions,
  CacheStats,
  MultiLevelCacheService as IMultiLevelCacheService,
  PrismaCacheMiddlewareOptions,
} from '../types/cache';

// ──────────────────────────────────────────────
// Helper: measure operation latency
// ──────────────────────────────────────────────
function nowMs(): number {
  return Date.now();
}

// ──────────────────────────────────────────────
// L1: In-Memory Cache (node-cache)
// ──────────────────────────────────────────────
export class MemoryCacheService implements CacheService {
  private store: NodeCache;
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.store = new NodeCache({
      stdTTL: cacheConfig.strategy.memory.defaultTtlSeconds,
      maxKeys: cacheConfig.strategy.memory.maxEntries ?? 10000,
      checkperiod: cacheConfig.strategy.memory.checkPeriodSeconds ?? 120,
      useClones: false,
    });
  }

  async get<T = CacheValue>(key: string, _options?: CacheGetOptions): Promise<T | null> {
    const value = this.store.get<T>(key);
    return value === undefined ? null : value;
  }

  async set<T = CacheValue>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const ttl = options?.ttlSeconds ?? cacheConfig.strategy.memory.defaultTtlSeconds;
    const success = this.store.set(key, value, ttl);

    if (success && options?.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
  }

  async del(key: string): Promise<void> {
    this.store.del(key);
    // Clean up tag index
    for (const [, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async incrBy(key: string, increment = 1): Promise<number> {
    const current = (this.store.get<number>(key) ?? 0) + increment;
    this.store.set(key, current);
    return current;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.store.ttl(key, ttlSeconds);
  }

  /** Return all keys for a given tag */
  getKeysByTag(tag: string): string[] {
    const keySet = this.tagIndex.get(tag);
    return keySet ? Array.from(keySet) : [];
  }

  /** Remove tag and its associated key set */
  removeTag(tag: string): void {
    this.tagIndex.delete(tag);
  }

  /** Get store stats */
  getStats(): { keys: number; hits: number; misses: number } {
    return this.store.getStats();
  }

  /** Flush all memory cache */
  flushAll(): void {
    this.store.flushAll();
    this.tagIndex.clear();
  }
}

// ──────────────────────────────────────────────
// L2: Redis Cache Service
// ──────────────────────────────────────────────
export class RedisCacheService implements CacheService {
  private clientPromise: Promise<RedisClient>;

  constructor(client?: RedisClient) {
    this.clientPromise = client ? Promise.resolve(client) : ensureRedisConnection();
  }

  private async getClient(): Promise<RedisClient> {
    return this.clientPromise;
  }

  async get<T = CacheValue>(key: string, _options?: CacheGetOptions): Promise<T | null> {
    const client = await this.getClient();
    const raw = await client.get(key);
    return safeJsonParse<T>(raw);
  }

  async set<T = CacheValue>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const client = await this.getClient();
    const payload = serializeValue(value);

    if (options?.ttlSeconds && options.ttlSeconds > 0) {
      await client.set(key, payload, 'EX', options.ttlSeconds);
    } else {
      await client.set(key, payload);
    }

    // Store tag associations in Redis SETs
    if (options?.tags && options.tags.length > 0) {
      const pipeline = client.pipeline();
      for (const tag of options.tags) {
        const tagKey = buildTagKey(tag);
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, options.ttlSeconds ?? cacheConfig.defaultTtlSeconds);
      }
      await pipeline.exec();
    }
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient();
    const n = await client.exists(key);
    return n === 1;
  }

  async incrBy(key: string, increment = 1): Promise<number> {
    const client = await this.getClient();
    return client.incrby(key, increment);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const client = await this.getClient();
    const res = await client.expire(key, ttlSeconds);
    return res === 1;
  }

  /** Get all keys associated with a tag via Redis SET */
  async getKeysByTag(tag: string): Promise<string[]> {
    const client = await this.getClient();
    const tagKey = buildTagKey(tag);
    return client.smembers(tagKey);
  }

  /** Remove a tag set from Redis */
  async removeTag(tag: string): Promise<void> {
    const client = await this.getClient();
    const tagKey = buildTagKey(tag);
    await client.del(tagKey);
  }

  /** Get the underlying Redis client (for pipeline operations) */
  async getRawClient(): Promise<RedisClient> {
    return this.getClient();
  }
}

// ──────────────────────────────────────────────
// Multi-Level Cache (L1: Memory + L2: Redis)
// ──────────────────────────────────────────────
export class MultiLevelCacheService implements IMultiLevelCacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    memoryHits: 0,
    redisHits: 0,
    averageLatencyMs: 0,
  };
  private latencySamples: number[] = [];
  private monitoringTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private memory: MemoryCacheService,
    private redis: RedisCacheService
  ) {
    if (cacheConfig.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  // ─── Monitoring ──────────────────────────
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      if (cacheConfig.monitoring.logStats) {
        const stats = this.getStats();
        console.log('[cache:stats]', JSON.stringify(stats));
      }
    }, cacheConfig.monitoring.snapshotIntervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      deletes: 0,
      memoryHits: 0,
      redisHits: 0,
      averageLatencyMs: 0,
    };
    this.latencySamples = [];
  }

  private recordHit(source: 'memory' | 'redis'): void {
    this.stats.hits++;
    if (source === 'memory') {
      this.stats.memoryHits++;
    } else {
      this.stats.redisHits++;
    }
  }

  private recordMiss(): void {
    this.stats.misses++;
  }

  private recordLatency(startMs: number): void {
    const latency = nowMs() - startMs;
    this.latencySamples.push(latency);
    // Keep a rolling average over the last 1000 samples
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift();
    }
    this.stats.averageLatencyMs =
      this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
  }

  // ─── Core Operations ─────────────────────
  async get<T = CacheValue>(key: string, options?: CacheGetOptions): Promise<T | null> {
    const start = nowMs();

    try {
      // Skip all caching if requested
      if (options?.skipCache) {
        this.recordMiss();
        return null;
      }

      // L1: Check memory cache (unless skipped)
      if (cacheConfig.strategy.memory.enabled && !options?.skipMemory) {
        const memValue = await this.memory.get<T>(key);
        if (memValue !== null) {
          this.recordHit('memory');
          this.recordLatency(start);
          return memValue;
        }
      }

      // L2: Check Redis
      if (cacheConfig.strategy.redis.enabled && cacheConfig.strategy.multiLevel) {
        try {
          const redisValue = await this.redis.get<T>(key);
          if (redisValue !== null) {
            this.recordHit('redis');
            // Populate L1 memory cache
            if (cacheConfig.strategy.memory.enabled) {
              await this.memory.set(key, redisValue, {
                ttlSeconds: cacheConfig.strategy.memory.defaultTtlSeconds,
              });
            }
            this.recordLatency(start);
            return redisValue;
          }
        } catch (err) {
          // Redis failed — fallback gracefully
          if (cacheConfig.fallbackEnabled) {
            console.warn('[cache] Redis unavailable, falling back to memory only', err);
          } else {
            throw err;
          }
        }
      }

      this.recordMiss();
      this.recordLatency(start);
      return null;
    } catch (err) {
      this.recordMiss();
      this.recordLatency(start);
      throw err;
    }
  }

  async set<T = CacheValue>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const start = nowMs();
    this.stats.sets++;

    const ttl = options?.ttlSeconds ?? cacheConfig.defaultTtlSeconds;

    // Set in L1 memory
    if (cacheConfig.strategy.memory.enabled) {
      await this.memory.set(key, value, { ttlSeconds: ttl, tags: options?.tags });
    }

    // Set in L2 Redis
    if (cacheConfig.strategy.redis.enabled) {
      try {
        await this.redis.set(key, value, { ttlSeconds: ttl, tags: options?.tags });
      } catch (err) {
        if (cacheConfig.fallbackEnabled) {
          console.warn('[cache] Redis set failed, value stored only in memory', err);
        } else {
          throw err;
        }
      }
    }

    this.recordLatency(start);
  }

  async del(key: string): Promise<void> {
    const start = nowMs();
    this.stats.deletes++;

    if (cacheConfig.strategy.memory.enabled) {
      await this.memory.del(key);
    }

    if (cacheConfig.strategy.redis.enabled) {
      try {
        await this.redis.del(key);
      } catch (err) {
        if (cacheConfig.fallbackEnabled) {
          console.warn('[cache] Redis del failed', err);
        } else {
          throw err;
        }
      }
    }

    this.recordLatency(start);
  }

  async exists(key: string): Promise<boolean> {
    if (cacheConfig.strategy.memory.enabled) {
      const memExists = await this.memory.exists(key);
      if (memExists) return true;
    }

    if (cacheConfig.strategy.redis.enabled) {
      try {
        return await this.redis.exists(key);
      } catch {
        if (cacheConfig.fallbackEnabled) return false;
        throw new Error('Cache existence check failed');
      }
    }

    return false;
  }

  async incrBy(key: string, increment = 1): Promise<number> {
    if (cacheConfig.strategy.redis.enabled) {
      try {
        const result = await this.redis.incrBy(key, increment);
        // Sync to memory
        if (cacheConfig.strategy.memory.enabled) {
          await this.memory.set(key, result, {
            ttlSeconds: cacheConfig.strategy.memory.defaultTtlSeconds,
          });
        }
        return result;
      } catch {
        if (cacheConfig.fallbackEnabled) {
          return this.memory.incrBy(key, increment);
        }
      }
    }
    return this.memory.incrBy(key, increment);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    let result = false;
    if (cacheConfig.strategy.memory.enabled) {
      result = await this.memory.expire(key, ttlSeconds);
    }
    if (cacheConfig.strategy.redis.enabled) {
      try {
        result = await this.redis.expire(key, ttlSeconds) || result;
      } catch {
        // noop
      }
    }
    return result;
  }

  // ─── Tags ────────────────────────────────
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!cacheConfig.useTags) return;

    const allKeys = new Set<string>();

    // Collect keys from memory tag index
    for (const tag of tags) {
      const memKeys = this.memory.getKeysByTag(tag);
      for (const k of memKeys) allKeys.add(k);
    }

    // Collect keys from Redis tag sets
    if (cacheConfig.strategy.redis.enabled) {
      try {
        const redisClient = await this.redis.getRawClient();
        const pipeline = redisClient.pipeline();

        for (const tag of tags) {
          const tagKey = buildTagKey(tag);
          // We'll collect keys separately and add to the pipeline
          const rKeys = await this.redis.getKeysByTag(tag);
          for (const k of rKeys) allKeys.add(k);
          pipeline.del(tagKey);
        }

        // Delete all collected keys from Redis
        const keysArr = Array.from(allKeys);
        if (keysArr.length > 0) {
          pipeline.del(...keysArr);
        }
        await pipeline.exec();
      } catch (err) {
        if (!cacheConfig.fallbackEnabled) throw err;
        console.warn('[cache] tag invalidation: Redis failed', err);
      }
    }

    // Delete from memory
    for (const key of allKeys) {
      await this.memory.del(key);
    }

    // Clean up memory tag index
    for (const tag of tags) {
      this.memory.removeTag(tag);
    }
  }

  async addTags(key: string, tags: string[]): Promise<void> {
    if (!cacheConfig.useTags) return;

    // Add to MemoryCache tag index directly (without resetting value/ttl)
    if (cacheConfig.strategy.memory.enabled) {
      const value = await this.memory.get(key);
      if (value !== null) {
        for (const tag of tags) {
          // Use internal MemoryCache method to add tag without re-setting value
          if (!(this.memory as any).tagIndex.has(tag)) {
            (this.memory as any).tagIndex.set(tag, new Set());
          }
          (this.memory as any).tagIndex.get(tag).add(key);
        }
      }
    }

    // Add to Redis tag sets (works regardless of whether key is in memory)
    if (cacheConfig.strategy.redis.enabled) {
      try {
        const redisClient = await this.redis.getRawClient();
        const pipeline = redisClient.pipeline();
        for (const tag of tags) {
          const tagKey = buildTagKey(tag);
          pipeline.sadd(tagKey, key);
        }
        await pipeline.exec();
      } catch (err) {
        if (!cacheConfig.fallbackEnabled) throw err;
        console.warn('[cache] addTags: Redis failed', err);
      }
    }
  }

  // ─── Warming ─────────────────────────────
  async warmUp(
    keys: string[],
    loader: (key: string) => Promise<CacheValue | null>
  ): Promise<void> {
    if (!cacheConfig.warming.enabled || keys.length === 0) return;

    console.log(`[cache] Warming ${keys.length} keys...`);
    const start = nowMs();

    // Process in batches of 50 to control concurrency
    const BATCH_SIZE = 50;
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (key) => {
          const value = await withRetry(() => loader(key), { maxRetries: 2 });
          if (value !== null) {
            await this.set(key, value);
          }
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      if (succeeded < batch.length) {
        console.warn(`[cache] Warm batch: ${succeeded}/${batch.length} keys loaded`);
      }
    }

    // Mark warming complete
    const warmingKey = buildWarmingKey('status');
    await this.set(warmingKey, { completed: true, timestamp: Date.now(), keysLoaded: keys.length });

    console.log(`[cache] Warming complete in ${nowMs() - start}ms`);
  }
}

// ──────────────────────────────────────────────
// Singleton exports (backward compatible)
// ──────────────────────────────────────────────
const memoryCacheService = new MemoryCacheService();
const redisCacheService = new RedisCacheService();

/**
 * Primary cache service instance.
 * Uses multi-level caching (L1: memory, L2: Redis) with fallback and stats.
 */
export const cache = new MultiLevelCacheService(memoryCacheService, redisCacheService);

/**
 * Direct access to Redis cache (L2 only) for specialized operations.
 */
export const redisCache = redisCacheService;

/**
 * Direct access to Memory cache (L1 only) for specialized operations.
 */
export const memoryCache = memoryCacheService;

// ──────────────────────────────────────────────
// Prisma Query Cache Middleware
// ──────────────────────────────────────────────
export interface PrismaModelDelegate {
  findUnique: (...args: any[]) => Promise<any>;
  findFirst: (...args: any[]) => Promise<any>;
  findMany: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<any>;
  aggregate: (...args: any[]) => Promise<any>;
}

export interface PrismaClientLike {
  $use: (middleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => void;
  [model: string]: PrismaModelDelegate | any;
}

/**
 * Creates a Prisma middleware that caches query results.
 *
 * Usage:
 *   prisma.$use(createPrismaCacheMiddleware(cache, { ttlSeconds: 300 }));
 */
export function createPrismaCacheMiddleware(
  cacheInstance: IMultiLevelCacheService,
  options: PrismaCacheMiddlewareOptions = {}
): (params: any, next: (params: any) => Promise<any>) => Promise<any> {
  const {
    ttlSeconds = cacheConfig.defaultTtlSeconds,
    models,
    operations = ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'],
    autoInvalidate = true,
  } = options;

  const modelSet = models ? new Set(models) : undefined;

  return async (params: any, next: (params: any) => Promise<any>) => {
    const { model, action, args } = params;

    // Skip if model not in the configured set
    if (modelSet && !modelSet.has(model)) {
      return next(params);
    }

    const isWriteOperation = ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany', 'createMany'].includes(action);

    // Auto-invalidate: on write, clear related cache entries
    if (isWriteOperation && autoInvalidate) {
      const result = await next(params);
      // Invalidate cache tags for this model
      try {
        await cacheInstance.invalidateByTags([`prisma:${model}`]);
      } catch (err) {
        console.warn(`[prisma-cache] Failed to invalidate tags for model ${model}`, err);
      }
      return result;
    }

    // Only cache specific read operations
    if (!operations.includes(action)) {
      return next(params);
    }

    // Build cache key from model, action, and hashed args
    // Hashing prevents extremely long keys for complex queries
    const argsHash = hashKey(serializeValue(args));
    const cacheKey = `prisma:${model}:${action}:${argsHash}`;

    // Check cache
    const cached = await cacheInstance.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await next(params);
    if (result !== null && result !== undefined) {
      await cacheInstance.set(cacheKey, result, {
        ttlSeconds,
        tags: [`prisma:${model}`, `prisma:${model}:${action}`],
      });
    }

    return result;
  };
}
