import { Request, Response } from 'express';
import { DistributedRateLimiter } from '../../middleware/distributedRateLimiter';
import { resetRateLimitConfigCache } from '../../config/rateLimit';

function makeReqRes() {
  const req = {
    method: 'GET',
    path: '/accounts/123',
    originalUrl: '/api/accounts/123',
    ip: '203.0.113.10',
    headers: {},
    query: {},
    socket: { remoteAddress: '203.0.113.10' },
  } as unknown as Request;

  const headers: Record<string, string> = {};
  const res = {
    set: jest.fn((key: string | Record<string, string>, value?: string) => {
      if (typeof key === 'string') {
        headers[key] = value ?? '';
      } else {
        Object.assign(headers, key);
      }
    }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  return { req, res, headers };
}

describe('DistributedRateLimiter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    resetRateLimitConfigCache();
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    resetRateLimitConfigCache();
    delete process.env.RATE_LIMIT_ENABLED;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows requests under the configured limit', async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([1, 2]),
    };

    const limiter = new DistributedRateLimiter({ redis: redis as never });
    const { req, res, headers } = makeReqRes();
    const next = jest.fn();

    await limiter.middleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(headers['RateLimit-Limit']).toBeDefined();
    expect(headers['RateLimit-Remaining']).toBeDefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 429 with headers when the limit is exceeded', async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([0, 100]),
    };

    const limiter = new DistributedRateLimiter({ redis: redis as never });
    const { req, res, headers } = makeReqRes();
    const next = jest.fn();

    await limiter.middleware()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headers['RateLimit-Limit']).toBeDefined();
    expect(headers['RateLimit-Remaining']).toBeDefined();
    expect(headers['Retry-After']).toBeDefined();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number),
        }),
      }),
    );
  });
});
