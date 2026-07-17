export type CacheValue = string | number | boolean | object | null;

export interface CacheEntry<T = CacheValue> {
  key: string;
  value: T;
  ttlSeconds?: number;
}

export interface CacheGetOptions {
  skipCache?: boolean;
  /** If true, skips memory cache and checks Redis only */
  skipMemory?: boolean;
}

export interface CacheSetOptions {
  ttlSeconds?: number;
  /** Tags for group invalidation */
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  memoryHits: number;
  redisHits: number;
  averageLatencyMs: number;
}

export interface CacheService {
  get<T = CacheValue>(key: string, options?: CacheGetOptions): Promise<T | null>;
  set<T = CacheValue>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  incrBy(key: string, increment?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
}

export interface CacheServiceWithStats extends CacheService {
  getStats(): CacheStats;
  resetStats(): void;
}

export interface CacheServiceWithTags extends CacheService {
  /** Invalidate all entries matching one or more tags */
  invalidateByTags(tags: string[]): Promise<void>;
  /** Add tags to an existing key */
  addTags(key: string, tags: string[]): Promise<void>;
}

export interface CacheServiceWithWarming extends CacheService {
  /** Pre-warm the cache with the given keys using the provided data loader */
  warmUp(keys: string[], loader: (key: string) => Promise<CacheValue | null>): Promise<void>;
}

export interface MultiLevelCacheService extends CacheService, CacheServiceWithStats, CacheServiceWithTags, CacheServiceWithWarming {}

/** Options for the Prisma query cache middleware */
export interface PrismaCacheMiddlewareOptions {
  /** Cache TTL in seconds */
  ttlSeconds?: number;
  /** Models to cache (e.g., ['User', 'Account']) */
  models?: string[];
  /** Operations to cache (default: ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate']) */
  operations?: string[];
  /** Whether to invalidate cache on write operations */
  autoInvalidate?: boolean;
}

/** Re-export for easier consumption */
export type { CacheConfig } from '../config/cache';
// Note: CacheTTL is a runtime const; import it directly from '../config/cache'
