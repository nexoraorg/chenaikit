import { Request, Response, NextFunction } from 'express';
import { cache } from '../services/cacheService';
import { CacheTTL } from '../config/cache';
import type { CacheSetOptions } from '../types/cache';

// ──────────────────────────────────────────────
// Response Cache Middleware
// ──────────────────────────────────────────────

export interface CacheMiddlewareOptions<T = unknown> {
  /** Build a cache key from the request */
  keyBuilder: (req: Request) => string;
  /** TTL in seconds (defaults to CacheTTL.DEFAULT) */
  ttlSeconds?: number;
  /** Optional transform before caching (e.g., strip sensitive fields) */
  serialize?: (payload: T) => unknown;
  /** Cache tags for group invalidation */
  tags?: string[];
  /** If true, skip reading from cache (force fresh response) */
  skipRead?: (req: Request) => boolean;
  /** If true, skip writing to cache (don't cache this response) */
  skipWrite?: (req: Request, body: T) => boolean;
}

/**
 * Express middleware that caches JSON responses.
 *
 * Usage:
 *   router.get('/users', cacheMiddleware({ keyBuilder: (req) => CacheKeys.userById(req.params.id) }));
 */
export function cacheMiddleware<T = unknown>(options: CacheMiddlewareOptions<T>) {
  const { keyBuilder } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyBuilder(req);

      // Optionally skip cache read
      const shouldSkipRead = options.skipRead?.(req) ?? false;

      if (!shouldSkipRead) {
        const cached = await cache.get<T>(key);
        if (cached !== null) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(cached);
        }
      }

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = ((body: any) => {
        const payload = (options.serialize ? options.serialize(body as T) : body) as any;

        // Optionally skip cache write
        const shouldSkipWrite = options.skipWrite?.(req, body as T) ?? false;

        if (!shouldSkipWrite) {
          const setOptions: CacheSetOptions = {
            ttlSeconds: options.ttlSeconds ?? CacheTTL.DEFAULT,
          };
          if (options.tags && options.tags.length > 0) {
            setOptions.tags = options.tags;
          }

          cache
            .set(key, payload, setOptions)
            .catch((err) => console.warn('[cache] set failed', err));
        }

        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch (err) {
      // On cache errors, fall through gracefully
      console.warn('[cache:middleware] error', err);
      next();
    }
  };
}

// ──────────────────────────────────────────────
// Cache Invalidation Middleware
// ──────────────────────────────────────────────

/**
 * Express middleware that invalidates specific cache keys after a request.
 *
 * Usage:
 *   router.post('/users/:id', invalidateCacheKeys((req) => [CacheKeys.userById(req.params.id)]));
 */
export function invalidateCacheKeys(keyProvider: (req: Request) => string[]) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      const keys = keyProvider(_req);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => cache.del(k)));
      }
      next();
    } catch (err) {
      console.warn('[cache:invalidate] error', err);
      next();
    }
  };
}

// ──────────────────────────────────────────────
// Tag-based Invalidation Middleware
// ──────────────────────────────────────────────

/**
 * Express middleware that invalidates cache entries by tag(s) after a request.
 *
 * Usage:
 *   router.delete('/users/:id', invalidateCacheByTags(['user', 'account']));
 */
export function invalidateCacheByTags(tags: string[]) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await cache.invalidateByTags(tags);
      next();
    } catch (err) {
      console.warn('[cache:invalidate:tags] error', err);
      next();
    }
  };
}

// ──────────────────────────────────────────────
// Cache Bypass Header Middleware
// ──────────────────────────────────────────────

/**
 * Middleware that sets a flag to skip cache when the request has a specific header.
 * Use in conjunction with cacheMiddleware's skipRead option.
 */
export function allowCacheBypass(req: Request): boolean {
  return req.headers['x-cache-bypass'] === 'true' || req.headers['cache-control'] === 'no-cache';
}

// ──────────────────────────────────────────────
// Cache Stats Endpoint Middleware
// ──────────────────────────────────────────────

/**
 * Express route handler that returns cache statistics.
 *
 * Usage:
 *   router.get('/admin/cache-stats', cacheStatsHandler);
 */
export async function cacheStatsHandler(_req: Request, res: Response) {
  try {
    const stats = cache.getStats();
    res.json({
      success: true,
      data: {
        ...stats,
        hitRatePercent: (stats.hitRate * 100).toFixed(2) + '%',
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics',
    });
  }
}

// ──────────────────────────────────────────────
// Backward-compatible exports
// ──────────────────────────────────────────────

/**
 * @deprecated Use `invalidateCacheKeys` instead.
 * Simple key-based invalidation middleware.
 */
export function invalidateCache(keys: string[]) {
  return invalidateCacheKeys(() => keys);
}
