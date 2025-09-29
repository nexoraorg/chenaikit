import { Request, Response, NextFunction } from 'express';
import { cache } from '../services/cacheService';

export interface CacheMiddlewareOptions<T> {
  keyBuilder: (req: Request) => string;
  ttlSeconds?: number;
  serialize?: (payload: T) => unknown;
}

export function cacheMiddleware<T = unknown>(options: CacheMiddlewareOptions<T>) {
  const { keyBuilder } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyBuilder(req);
      const cached = await cache.get<T>(key);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: any) => {
        const payload = (options.serialize ? options.serialize(body as T) : body) as any;
        cache
          .set(key, payload, { ttlSeconds: options.ttlSeconds })
          .catch((err) => console.warn('[cache] set failed', err));
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function invalidateCache(keys: string[]) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await Promise.all(keys.map((k) => cache.del(k)));
      next();
    } catch (err) {
      next(err);
    }
  };
}


