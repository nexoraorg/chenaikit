import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { createRedisClient } from '../config/redis';
import { getRateLimitConfig, RateLimitRule } from '../config/rateLimit';
import {
  attachUserForRateLimit,
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

const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local maxCount = tonumber(ARGV[3])
  local member = ARGV[4]
  local windowStart = now - windowMs

  redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
  local count = redis.call('ZCARD', key)

  if count < maxCount then
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
    return {1, count + 1}
  end
  return {0, count}
`;

export class DistributedRateLimiter {
  private redis: Redis;
  private onLimitReached?: (req: Request, info: RateLimitInfo) => void;

  constructor(options: DistributedRateLimitOptions = {}) {
    this.redis = options.redis ?? createRedisClient();
    this.onLimitReached = options.onLimitReached;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  async checkSlidingWindow(
    key: string,
    rule: RateLimitRule,
    scope: RateLimitInfo['scope'],
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

    try {
      const results = (await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now.toString(),
        rule.windowMs.toString(),
        rule.max.toString(),
        member,
      )) as [number, number];

      const allowed = results[0] === 1;
      const currentCount = results[1];

      const resetTime = new Date(now + rule.windowMs);
      const remaining = allowed ? Math.max(0, rule.max - currentCount) : 0;
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
      attachUserForRateLimit(req);

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
      attachUserForRateLimit(req);

      if (shouldSkipRateLimit(req) || shouldBypassRateLimit(req)) {
        next();
        return;
      }

      try {
        const base = resolveRateLimitRule(req);
        const { scope } = base;
        const key = `${base.key}:${keySuffix}`;
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

export async function resetDistributedRateLimiter(): Promise<void> {
  if (cachedLimiter) {
    await cachedLimiter.close();
  }
  cachedLimiter = null;
}
