import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { createRedisClient } from '../config/redis';
import { getRateLimitConfig, RateLimitRule } from '../config/rateLimit';
import {
  logRateLimitViolation,
  RateLimitInfo,
  resolveRateLimitRule,
  sendRateLimitExceeded,
  setRateLimitHeaders,
  shouldBypassRateLimit,
  shouldSkipRateLimit,
} from '../utils/rateLimitUtils';
import { metricsService } from '../services/metricsService';
import { log } from '../utils/logger';

export interface DistributedRateLimitOptions {
  redis?: Redis;
  onLimitReached?: (req: Request, info: RateLimitInfo) => void;
}

export class DistributedRateLimiter {
  private redis: Redis;
  private onLimitReached?: (req: Request, info: RateLimitInfo) => void;

  constructor(options: DistributedRateLimitOptions = {}) {
    this.redis = options.redis ?? createRedisClient();
    this.onLimitReached = options.onLimitReached;
  }

  async checkSlidingWindow(
    key: string,
    rule: RateLimitRule,
    scope: RateLimitInfo['scope'],
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(rule.windowMs / 1000));
      const results = await pipeline.exec();

      const currentCount = (results?.[1]?.[1] as number) || 0;
      const allowed = currentCount < rule.max;

      if (allowed) {
        await this.redis.zadd(key, now, member);
      }

      const resetTime = new Date(now + rule.windowMs);
      const remaining = Math.max(0, rule.max - currentCount - (allowed ? 1 : 0));
      const retryAfter = allowed
        ? undefined
        : Math.max(1, Math.ceil((resetTime.getTime() - now) / 1000));

      return {
        allowed,
        info: {
          limit: rule.max,
          remaining,
          resetTime,
          retryAfter,
          scope,
        },
      };
    } catch (error) {
      log.error('Distributed rate limiter Redis error', error as Error);
      const config = getRateLimitConfig();

      if (!config.failOpen) {
        return {
          allowed: false,
          info: {
            limit: rule.max,
            remaining: 0,
            resetTime: new Date(now + rule.windowMs),
            retryAfter: Math.ceil(rule.windowMs / 1000),
            scope,
          },
        };
      }

      return {
        allowed: true,
        info: {
          limit: rule.max,
          remaining: rule.max,
          resetTime: new Date(now + rule.windowMs),
          scope,
        },
      };
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (shouldSkipRateLimit(req) || shouldBypassRateLimit(req)) {
        next();
        return;
      }

      try {
        const { key, rule, scope } = resolveRateLimitRule(req);
        const result = await this.checkSlidingWindow(key, rule, scope);

        setRateLimitHeaders(res, result.info);

        if (!result.allowed) {
          metricsService.recordRateLimitExceeded(scope);
          logRateLimitViolation(req, result.info);
          this.onLimitReached?.(req, result.info);
          sendRateLimitExceeded(res, result.info);
          return;
        }

        next();
      } catch (error) {
        log.error('Distributed rate limiter middleware error', error as Error);
        next();
      }
    };
  }

  endpointMiddleware(rule: RateLimitRule, keySuffix: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (shouldSkipRateLimit(req) || shouldBypassRateLimit(req)) {
        next();
        return;
      }

      try {
        const { scope } = resolveRateLimitRule(req);
        const base = resolveRateLimitRule(req);
        const key = `${base.key}:${keySuffix}`;
        const result = await this.checkSlidingWindow(key, rule, scope);

        setRateLimitHeaders(res, result.info);

        if (!result.allowed) {
          metricsService.recordRateLimitExceeded(scope);
          logRateLimitViolation(req, result.info);
          sendRateLimitExceeded(res, result.info);
          return;
        }

        next();
      } catch (error) {
        log.error('Endpoint rate limiter middleware error', error as Error);
        next();
      }
    };
  }
}

let cachedLimiter: DistributedRateLimiter | null = null;

export function createDistributedRateLimiter(
  options: DistributedRateLimitOptions = {},
): DistributedRateLimiter {
  return new DistributedRateLimiter(options);
}

export function getDistributedRateLimiter(): DistributedRateLimiter {
  if (!cachedLimiter) {
    cachedLimiter = createDistributedRateLimiter();
  }
  return cachedLimiter;
}

export function resetDistributedRateLimiter(): void {
  cachedLimiter = null;
}
