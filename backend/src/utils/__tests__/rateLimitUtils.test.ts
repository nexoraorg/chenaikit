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
  beforeEach(() => {
    resetRateLimitConfigCache();
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    resetRateLimitConfigCache();
    delete process.env.RATE_LIMIT_ENABLED;
    delete process.env.RATE_LIMIT_ADMIN_BYPASS_TOKEN;
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
    expect(resolved.key).toContain('rate_limit:ip:203.0.113.10');
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
    expect(resolved.key).toContain('rate_limit:user:user-1');
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

  it('reads forwarded client IPs', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
    });
    expect(getClientIp(req)).toBe('198.51.100.1');
  });
});
