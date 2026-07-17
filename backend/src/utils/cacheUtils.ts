import { cacheConfig } from '../config/cache';

/**
 * Build a cache tag key used for group invalidation.
 * Tag keys are stored as Redis sets containing all cache keys associated with the tag.
 */
export function buildTagKey(tag: string): string {
  return `${cacheConfig.keyPrefix}:tag:${tag}`;
}

/**
 * Compute a safe hash for a cache key to keep keys within reasonable length.
 * Uses a simple DJB2 hash for performance.
 */
export function hashKey(raw: string): string {
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build a namespaced cache key from parts.
 * Automatically hashes keys that are too long.
 */
export function buildCacheKey(parts: (string | number | undefined | null)[]): string {
  const cleaned = parts.filter((p) => p !== undefined && p !== null && String(p).length > 0);
  const full = cleaned.join(':');
  if (full.length > 200) {
    // Long keys — hash the latter portion
    return `${cacheConfig.keyPrefix}:${cleaned.slice(0, 2).join(':')}:h:${hashKey(cleaned.slice(2).join(':'))}`;
  }
  return `${cacheConfig.keyPrefix}:${full}`;
}

/**
 * Simple exponential backoff for retryable operations.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Check if a cached value is stale (null/undefined).
 */
export function isStale(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Safe JSON parse for cache values.
 */
export function safeJsonParse<T>(raw: string | null): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

/**
 * Serialize a value for cache storage.
 */
export function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Estimate the size of a cached value in bytes for monitoring.
 */
export function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 4;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Generate a cache-warming key used to track warming status.
 */
export function buildWarmingKey(name: string): string {
  return `${cacheConfig.keyPrefix}:warm:${name}`;
}
