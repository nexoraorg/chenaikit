import { Request, Response, NextFunction } from 'express';

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

  constructor(options: RateLimitOptions) {
    this.options = {
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      ...options
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
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
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowEnd = now + this.options.windowMs;

      if (!this.store[key] || this.store[key].resetTime <= now) {
        this.store[key] = {
          count: 1,
          resetTime: windowEnd
        };
      } else {
        this.store[key].count++;
      }

      const current = this.store[key];
      const remaining = Math.max(0, this.options.max - current.count);

      if (this.options.standardHeaders) {
        res.set({
          'RateLimit-Limit': this.options.max.toString(),
          'RateLimit-Remaining': remaining.toString(),
          'RateLimit-Reset': new Date(current.resetTime).toISOString()
        });
      }

      if (this.options.legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': this.options.max.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString()
        });
      }

      if (current.count > this.options.max) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.options.message,
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    };
  }
}

// Pre-configured rate limiters
export const generalRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

export const createAccountRateLimit = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 account creations per hour
  message: 'Too many account creation attempts from this IP, please try again later.'
});