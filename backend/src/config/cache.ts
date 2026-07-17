export interface CacheTierConfig {
  /** Whether this cache tier is enabled */
  enabled: boolean;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Maximum number of entries (only applies to in-memory tier) */
  maxEntries?: number;
  /** Check period for expired entries in seconds (in-memory only) */
  checkPeriodSeconds?: number;
}

export interface CacheStrategyConfig {
  /** In-memory (L1) cache configuration using node-cache */
  memory: CacheTierConfig;
  /** Redis (L2) cache configuration using ioredis */
  redis: CacheTierConfig;
  /** Whether to use multi-level caching (L1 + L2) */
  multiLevel: boolean;
}

export interface CacheMonitoringConfig {
  /** Whether to track cache statistics */
  enabled: boolean;
  /** Interval (ms) between stat snapshots */
  snapshotIntervalMs: number;
  /** Whether to log cache hit/miss ratios periodically */
  logStats: boolean;
}

export interface CacheWarmingConfig {
  /** Whether cache warming is enabled */
  enabled: boolean;
  /** Keys to pre-warm on startup */
  warmupKeys: string[];
  /** Delay in ms before warming starts after server start */
  startupDelayMs: number;
}

export interface CacheConfig {
  /** Global default TTL in seconds */
  defaultTtlSeconds: number;
  /** Strategy-specific configurations */
  strategy: CacheStrategyConfig;
  /** Monitoring configuration */
  monitoring: CacheMonitoringConfig;
  /** Warming configuration */
  warming: CacheWarmingConfig;
  /** Whether to use cache tags for group invalidation */
  useTags: boolean;
  /** Whether to fall back gracefully when cache is unavailable */
  fallbackEnabled: boolean;
  /** Prefix used for cache keys in Redis */
  keyPrefix: string;
}

/**
 * Central cache configuration.
 * All values can be overridden via environment variables.
 */
export const cacheConfig: CacheConfig = {
  defaultTtlSeconds: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10),

  strategy: {
    memory: {
      enabled: process.env.CACHE_MEMORY_ENABLED !== 'false',
      defaultTtlSeconds: parseInt(process.env.CACHE_MEMORY_TTL || '60', 10),
      maxEntries: parseInt(process.env.CACHE_MEMORY_MAX_ENTRIES || '10000', 10),
      checkPeriodSeconds: parseInt(process.env.CACHE_MEMORY_CHECK_PERIOD || '120', 10),
    },
    redis: {
      enabled: process.env.CACHE_REDIS_ENABLED !== 'false',
      defaultTtlSeconds: parseInt(process.env.CACHE_REDIS_TTL || '300', 10),
    },
    multiLevel: process.env.CACHE_MULTI_LEVEL !== 'false',
  },

  monitoring: {
    enabled: process.env.CACHE_MONITORING_ENABLED !== 'false',
    snapshotIntervalMs: parseInt(process.env.CACHE_MONITORING_INTERVAL || '60000', 10),
    logStats: process.env.CACHE_LOG_STATS === 'true',
  },

  warming: {
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    warmupKeys: (process.env.CACHE_WARMUP_KEYS || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    startupDelayMs: parseInt(process.env.CACHE_WARMUP_DELAY || '5000', 10),
  },

  useTags: process.env.CACHE_USE_TAGS !== 'false',
  fallbackEnabled: process.env.CACHE_FALLBACK_ENABLED !== 'false',
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'cak',
};

/**
 * Common TTL presets for different cache categories.
 */
export const CacheTTL = {
  /** Short-lived data: 1 minute */
  SHORT: 60,
  /** Default: 5 minutes */
  DEFAULT: cacheConfig.defaultTtlSeconds,
  /** Medium-lived data: 15 minutes */
  MEDIUM: 900,
  /** Long-lived data: 1 hour */
  LONG: 3600,
  /** Very long: 24 hours */
  DAY: 86400,
  /** Session data: 30 minutes */
  SESSION: 1800,
  /** Configuration data: 1 hour */
  CONFIG: 3600,
  /** Analytics / aggregate data: 10 minutes */
  ANALYTICS: 600,
  /** User profile data: 30 minutes */
  USER_PROFILE: 1800,
} as const;

export default cacheConfig;
