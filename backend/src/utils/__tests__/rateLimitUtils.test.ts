import { Request } from 'express';
import { resetRateLimitConfigCache, loadRateLimitConfig } from '../../config/rateLimit';
import {
  buildEndpointKey,
  getClientIp,
  isWhitelistedIp,
  normalizeRoutePath,
  resolveRateLimitRule,
  shouldBypassRateLimit,
  shouldSkipRateLimit,
} from '../../utils/rateLimitUtils';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/accounts/123',
    originalUrl: '/api/accounts/123',
    ip: '203.0.113.10',
    headers: {},
    query: {},
    socket: { remoteAddress: '203.0.113.10' },
    ...overrides,
  } as Request;
}

describe('rateLimitUtils', () => {
  const originalEnv = {
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_ADMIN_BYPASS_TOKEN: process.env.RATE_LIMIT_ADMIN_BYPASS_TOKEN,
    RATE_LIMIT_WHITELIST_IPS: process.env.RATE_LIMIT_WHITELIST_IPS,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    resetRateLimitConfigCache();
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    resetRateLimitConfigCache();
    process.env.RATE_LIMIT_ENABLED = originalEnv.RATE_LIMIT_ENABLED;
    process.env.RATE_LIMIT_ADMIN_BYPASS_TOKEN = originalEnv.RATE_LIMIT_ADMIN_BYPASS_TOKEN;
    process.env.RATE_LIMIT_WHITELIST_IPS = originalEnv.RATE_LIMIT_WHITELIST_IPS;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  });

  it('normalizes versioned and unversioned API paths', () => {
    expect(normalizeRoutePath('/api/v1/auth/login')).toBe('/auth/login');
    expect(normalizeRoutePath('/api/auth/login')).toBe('/auth/login');
  });

  it('builds endpoint keys from method and path', () => {
    expect(buildEndpointKey('post', '/api/auth/login')).toBe('POST /auth/login');
  });

  it('resolves IP-based limits for anonymous requests', () => {
    const req = makeReq();
    const resolved = resolveRateLimitRule(req);

    expect(resolved.scope).toBe('ip');
    expect(resolved.key).toBe('rate_limit:ip:203.0.113.10');
    expect(resolved.rule.max).toBeGreaterThan(0);
  });

  it('resolves user-based limits when a user is attached', () => {
    const req = makeReq({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
      },
    });
    const resolved = resolveRateLimitRule(req);

    expect(resolved.scope).toBe('user');
    expect(resolved.key).toBe('rate_limit:user:user-1');
  });

  it('resolves tier-based limits for API keys', () => {
    const req = makeReq({
      apiKey: {
        id: 'key-1',
        tier: 'PRO',
      } as never,
    });
    const resolved = resolveRateLimitRule(req);

    expect(resolved.scope).toBe('api_key');
    expect(resolved.key).toBe('rate_limit:api_key:key-1');
    expect(resolved.rule.max).toBe(loadRateLimitConfig().tierLimits.PRO.max);
  });

  it('uses endpoint-specific limits when configured', () => {
    const req = makeReq({
      method: 'POST',
      path: '/auth/login',
      originalUrl: '/api/auth/login',
    });
    const resolved = resolveRateLimitRule(req);

    expect(resolved.rule.max).toBe(10);
    expect(resolved.key).toBe('rate_limit:ip:203.0.113.10:POST /auth/login');
  });

  it('skips health and metrics paths', () => {
    expect(
      shouldSkipRateLimit(makeReq({ path: '/health', originalUrl: '/api/health' })),
    ).toBe(true);
    expect(
      shouldSkipRateLimit(makeReq({ path: '/metrics', originalUrl: '/metrics' })),
    ).toBe(true);
  });

  it('bypasses whitelisted IPs and admin users', () => {
    process.env.RATE_LIMIT_WHITELIST_IPS = '203.0.113.10';
    resetRateLimitConfigCache();

    expect(isWhitelistedIp('203.0.113.10')).toBe(true);
    expect(shouldBypassRateLimit(makeReq())).toBe(true);

    resetRateLimitConfigCache();
    expect(
      shouldBypassRateLimit(
        makeReq({
          ip: '198.51.100.4',
          user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
        }),
      ),
    ).toBe(true);
  });

  it('bypasses when the admin token header matches', () => {
    process.env.RATE_LIMIT_ADMIN_BYPASS_TOKEN = 'secret-bypass';
    resetRateLimitConfigCache();

    expect(
      shouldBypassRateLimit(
        makeReq({
          headers: { 'x-rate-limit-bypass': 'secret-bypass' },
        }),
      ),
    ).toBe(true);
  });

  it('prefers Express req.ip over spoofable forwarded headers', () => {
    const req = makeReq({
      ip: '203.0.113.10',
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
    });
    expect(getClientIp(req)).toBe('203.0.113.10');
  });

  it('falls back to socket remote address when req.ip is missing', () => {
    const req = makeReq({
      ip: undefined,
      socket: { remoteAddress: '10.0.0.5' },
    });
    expect(getClientIp(req)).toBe('10.0.0.5');
  });
});
