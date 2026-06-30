import { Request, Response, NextFunction } from 'express';
import { getRateLimitConfig, RATE_LIMIT_WINDOWS } from '../config/rateLimit';
import {
  RateLimitInfo,
  sendRateLimitExceeded,
  setRateLimitHeaders,
} from '../utils/rateLimitUtils';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private options: RateLimitOptions;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options: RateLimitOptions) {
    this.options = {
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: true,
      ...options,
    };

    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    this.cleanupTimer.unref?.();
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime <= now) {
        delete this.store[key];
      }
    }
  }

  private getKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private buildInfo(currentCount: number, resetTime: number): RateLimitInfo {
    const remaining = Math.max(0, this.options.max - currentCount);
    const retryAfter =
      currentCount > this.options.max
        ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
        : undefined;

    return {
      limit: this.options.max,
      remaining,
      resetTime: new Date(resetTime),
      retryAfter,
      scope: 'ip',
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowEnd = now + this.options.windowMs;

      if (!this.store[key] || this.store[key].resetTime <= now) {
        this.store[key] = {
          count: 1,
          resetTime: windowEnd,
        };
      } else {
        this.store[key].count++;
      }

      const current = this.store[key];
      const info = this.buildInfo(current.count, current.resetTime);

      if (this.options.standardHeaders || this.options.legacyHeaders) {
        setRateLimitHeaders(res, info);
      }

      if (current.count > this.options.max) {
        return sendRateLimitExceeded(res, info, this.options.message);
      }

      next();
    };
  }
}

const config = getRateLimitConfig();

export const generalRateLimit = new RateLimiter({
  windowMs: config.defaultIpLimit.windowMs,
  max: config.defaultIpLimit.max,
  message: 'Too many requests from this IP, please try again later.',
});

export const createAccountRateLimit = new RateLimiter({
  windowMs: RATE_LIMIT_WINDOWS.hour,
  max: 5,
  message: 'Too many account creation attempts from this IP, please try again later.',
});

export { getDistributedRateLimiter, createDistributedRateLimiter } from './distributedRateLimiter';
