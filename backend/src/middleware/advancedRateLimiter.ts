import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { ApiKey, API_TIER_CONFIGS, ApiTier } from '../models/ApiKey';
import { log } from '../utils/logger';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
}

export interface AdvancedRateLimitOptions {
  redis?: Redis;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response, info: RateLimitInfo) => void;
}

export class AdvancedRateLimiter {
  private redis: Redis;
  private options: AdvancedRateLimitOptions;

  constructor(options: AdvancedRateLimitOptions = {}) {
    this.redis = options.redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.options = {
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...options,
    };
  }

  private defaultKeyGenerator(req: Request): string {
    const apiKey = (req as any).apiKey;
    if (apiKey) {
      return `api_key:${apiKey.id}`;
    }
    return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
  }

  /**
   * Token bucket algorithm implementation
   */
  private async tokenBucket(
    key: string,
    limit: number,
    windowMs: number,
    tokensRequested: number = 1
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSizeSeconds = Math.ceil(windowMs / 1000);
    const refillRate = limit / windowSizeSeconds; // tokens per second

    try {
      const pipeline = this.redis.pipeline();
      
      // Get current bucket state
      pipeline.hgetall(key);
      // Set expiration if key doesn't exist
      pipeline.expire(key, windowSizeSeconds * 2);
      
      const results = await pipeline.exec();
      const current = results?.[0]?.[1] as any || {};
      
      let tokens = parseFloat(current.tokens || limit.toString());
      let lastRefill = parseInt(current.lastRefill || now.toString());

      // Refill tokens based on time elapsed
      const timeElapsed = Math.max(0, now - lastRefill);
      const tokensToAdd = Math.floor(timeElapsed * refillRate / 1000);
      tokens = Math.min(limit, tokens + tokensToAdd);
      lastRefill = now;

      // Check if request can be processed
      const allowed = tokens >= tokensRequested;
      
      if (allowed) {
        tokens -= tokensRequested;
      }

      // Update bucket state
      await this.redis.hmset(key, {
        tokens: tokens.toString(),
        lastRefill: lastRefill.toString(),
      });

      const resetTime = new Date(lastRefill + windowMs);
      const remaining = Math.max(0, tokens);

      return {
        allowed,
        info: {
          limit,
          remaining,
          resetTime,
          retryAfter: allowed ? undefined : Math.ceil((resetTime.getTime() - now) / 1000),
        },
      };
    } catch (error: any) {
      log.error('Rate limiter Redis error', error as Error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        info: {
          limit,
          remaining: limit,
          resetTime: new Date(now + windowMs),
        },
      };
    }
  }

  /**
   * Sliding window algorithm implementation
   */
  private async slidingWindow(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const pipeline = this.redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Count current entries
      pipeline.zcard(key);
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = results?.[1]?.[1] as number || 0;

      const allowed = currentCount < limit;

      if (allowed) {
        // Add current request
        await this.redis.zadd(key, now, now.toString());
      }

      const resetTime = new Date(now + windowMs);
      const remaining = Math.max(0, limit - currentCount - (allowed ? 1 : 0));

      return {
        allowed,
        info: {
          limit,
          remaining,
          resetTime,
          retryAfter: allowed ? undefined : Math.ceil((resetTime.getTime() - now) / 1000),
        },
      };
    } catch (error: any) {
      log.error('Rate limiter Redis error', error as Error);
      // Fail open
      return {
        allowed: true,
        info: {
          limit,
          remaining: limit,
          resetTime: new Date(now + windowMs),
        },
      };
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(
    req: Request,
    algorithm: 'token-bucket' | 'sliding-window' = 'token-bucket'
  ): Promise<RateLimitResult> {
    const key = this.options.keyGenerator!(req);
    
    // Get rate limit config based on API key tier or default
    let limit = 100; // default limit
    let windowMs = 15 * 60 * 1000; // 15 minutes default

    const apiKey = (req as any).apiKey as ApiKey;
    if (apiKey) {
      const tierConfig = API_TIER_CONFIGS[apiKey.tier];
      limit = tierConfig.rateLimit.max;
      windowMs = tierConfig.rateLimit.windowMs;
    }

    if (algorithm === 'token-bucket') {
      return this.tokenBucket(key, limit, windowMs);
    } else {
      return this.slidingWindow(key, limit, windowMs);
    }
  }

  /**
   * Middleware factory
   */
  middleware(algorithm: 'token-bucket' | 'sliding-window' = 'token-bucket') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await this.checkLimit(req, algorithm);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': result.info.limit.toString(),
          'X-RateLimit-Remaining': result.info.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.info.resetTime.getTime() / 1000).toString(),
        });

        if (!result.allowed) {
          if (result.info.retryAfter) {
            res.set('Retry-After', result.info.retryAfter.toString());
          }

          // Call custom limit reached handler if provided
          if (this.options.onLimitReached) {
            this.options.onLimitReached(req, res, result.info);
          }

          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later.',
              retryAfter: result.info.retryAfter,
              resetTime: result.info.resetTime.toISOString(),
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        next();
      } catch (error: any) {
        log.error('Rate limiter middleware error', error as Error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  /**
   * IP-based rate limiting middleware
   */
  ipRateLimitMiddleware(limit: number, windowMs: number) {
    return this.middlewareWithOptions({
      keyGenerator: (req: Request) => `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`,
      customLimit: { limit, windowMs },
    });
  }

  /**
   * Middleware with custom options
   */
  middlewareWithOptions(options: Partial<AdvancedRateLimitOptions> & { customLimit?: { limit: number; windowMs: number } }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = options.keyGenerator ? options.keyGenerator(req) : this.defaultKeyGenerator(req);
        
        let limit = 100;
        let windowMs = 15 * 60 * 1000;

        if (options.customLimit) {
          limit = options.customLimit.limit;
          windowMs = options.customLimit.windowMs;
        } else {
          const apiKey = (req as any).apiKey as ApiKey;
          if (apiKey) {
            const tierConfig = API_TIER_CONFIGS[apiKey.tier];
            limit = tierConfig.rateLimit.max;
            windowMs = tierConfig.rateLimit.windowMs;
          }
        }

        const result = await this.tokenBucket(key, limit, windowMs);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': result.info.limit.toString(),
          'X-RateLimit-Remaining': result.info.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.info.resetTime.getTime() / 1000).toString(),
        });

        if (!result.allowed) {
          if (result.info.retryAfter) {
            res.set('Retry-After', result.info.retryAfter.toString());
          }

          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later.',
              retryAfter: result.info.retryAfter,
              resetTime: result.info.resetTime.toISOString(),
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        next();
      } catch (error: any) {
        log.error('Rate limiter middleware error', error as Error);
        next();
      }
    };
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key: string): Promise<RateLimitInfo | null> {
    try {
      const data = await this.redis.hgetall(key);
      if (!data.tokens) return null;

      const tokens = parseFloat(data.tokens);
      const lastRefill = parseInt(data.lastRefill);
      const limit = parseFloat(data.limit || '100');
      const windowMs = parseInt(data.windowMs || '900000');

      const now = Date.now();
      const resetTime = new Date(lastRefill + windowMs);
      const remaining = Math.max(0, tokens);

      return {
        limit,
        remaining,
        resetTime,
      };
    } catch (error: any) {
      log.error('Failed to get rate limit status', error as Error);
      return null;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      log.info('Rate limit reset for key', { key });
    } catch (error: any) {
      log.error('Failed to reset rate limit', error as Error);
    }
  }

  /**
   * Clean up expired keys
   */
  async cleanup(): Promise<number> {
    try {
      // Redis handles expiration automatically, but we can clean up any lingering keys
      const keys = await this.redis.keys('*');
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.redis.expire(key, 3600); // Set 1 hour expiration
          cleaned++;
        }
      }

      return cleaned;
    } catch (error: any) {
      log.error('Failed to cleanup rate limiter', error as Error);
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Pre-configured rate limiters for different tiers
export const createTieredRateLimiter = (redis?: Redis): AdvancedRateLimiter => {
  return new AdvancedRateLimiter({
    redis,
    onLimitReached: (req, res, info) => {
      log.warn('Rate limit reached', {
        key: req.ip || 'unknown',
        limit: info.limit,
        resetTime: info.resetTime,
        userAgent: req.headers['user-agent'],
      });
    },
  });
};
