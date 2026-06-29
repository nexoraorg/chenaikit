import { NextFunction, Request, Response } from 'express';
import { ApiTier } from '../models/ApiKey';
import { getRateLimitConfig, RateLimitRule } from '../config/rateLimit';
import { verifyAccessToken } from './jwt';
import { log } from './logger';

export type RateLimitScope = 'api_key' | 'user' | 'ip';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  scope: RateLimitScope;
}

export interface ResolvedRateLimit {
  key: string;
  rule: RateLimitRule;
  scope: RateLimitScope;
}

export function getClientIp(req: Request): string {
  if (req.ip) {
    return req.ip;
  }
  return req.socket.remoteAddress || 'unknown';
}

export function normalizeRoutePath(path: string): string {
  return path
    .replace(/^\/api\/v[0-9]+/, '')
    .replace(/^\/api/, '')
    .replace(/\/+$/, '') || '/';
}

export function shouldSkipRateLimit(req: Request): boolean {
  const config = getRateLimitConfig();
  if (!config.enabled) {
    return true;
  }

  const originalPath = req.originalUrl.split('?')[0] || req.path;
  return config.skipPaths.some(
    (pattern) => pattern.test(originalPath) || pattern.test(req.path),
  );
}

export function buildEndpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizeRoutePath(path)}`;
}

export function resolveRateLimitRule(req: Request): ResolvedRateLimit {
  const config = getRateLimitConfig();
  const endpointKey = buildEndpointKey(req.method, req.path);
  const endpointRule = config.endpointLimits[endpointKey];

  if (req.apiKey) {
    const tier = req.apiKey.tier as ApiTier;
    const baseKey = `rate_limit:api_key:${req.apiKey.id}`;
    const rule = endpointRule ?? config.tierLimits[tier];
    return {
      key: endpointRule ? `${baseKey}:${endpointKey}` : baseKey,
      rule,
      scope: 'api_key',
    };
  }

  if (req.user?.id) {
    const baseKey = `rate_limit:user:${req.user.id}`;
    const rule = endpointRule ?? config.defaultIpLimit;
    return {
      key: endpointRule ? `${baseKey}:${endpointKey}` : baseKey,
      rule,
      scope: 'user',
    };
  }

  const ip = getClientIp(req);
  const baseKey = `rate_limit:ip:${ip}`;
  const rule = endpointRule ?? config.defaultIpLimit;
  return {
    key: endpointRule ? `${baseKey}:${endpointKey}` : baseKey,
    rule,
    scope: 'ip',
  };
}

export function isWhitelistedIp(ip: string): boolean {
  return getRateLimitConfig().whitelistIps.includes(ip);
}

export function shouldBypassRateLimit(req: Request): boolean {
  const config = getRateLimitConfig();
  const ip = getClientIp(req);

  if (isWhitelistedIp(ip)) {
    return true;
  }

  if (req.user?.role === 'admin') {
    return true;
  }

  const bypassHeader = req.headers['x-rate-limit-bypass'];
  if (
    config.adminBypassToken &&
    typeof bypassHeader === 'string' &&
    bypassHeader === config.adminBypassToken
  ) {
    return true;
  }

  return false;
}

export function setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
  res.set({
    'RateLimit-Limit': info.limit.toString(),
    'RateLimit-Remaining': info.remaining.toString(),
    'RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
    'X-RateLimit-Scope': info.scope,
  });

  if (info.retryAfter !== undefined) {
    res.set('Retry-After', info.retryAfter.toString());
  }
}

export function sendRateLimitExceeded(
  res: Response,
  info: RateLimitInfo,
  message = 'Too many requests, please try again later.',
): void {
  setRateLimitHeaders(res, info);
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter: info.retryAfter,
      resetTime: info.resetTime.toISOString(),
      scope: info.scope,
      timestamp: new Date().toISOString(),
    },
  });
}

export function attachUserForRateLimit(req: Request): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader?.split(' ')[1];

  if (!token) {
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Rate limiting falls back to IP when the token is invalid.
  }
}

export function optionalAuthenticateForRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  attachUserForRateLimit(req);
  next();
}

export function attachApiKeyFromHeader(req: Request): void {
  if (req.apiKey) {
    return;
  }

  const apiKeyHeader = req.headers['x-api-key'];
  const apiKeyQuery = req.query.api_key;
  const rawKey =
    (typeof apiKeyHeader === 'string' && apiKeyHeader) ||
    (typeof apiKeyQuery === 'string' && apiKeyQuery) ||
    undefined;

  if (rawKey) {
    (req as Request & { rawApiKey?: string }).rawApiKey = rawKey;
  }
}

export function logRateLimitViolation(req: Request, info: RateLimitInfo): void {
  log.warn('Rate limit exceeded', {
    scope: info.scope,
    path: req.path,
    method: req.method,
    ip: getClientIp(req),
    userId: req.user?.id,
    apiKeyId: req.apiKey?.id,
    limit: info.limit,
    resetTime: info.resetTime.toISOString(),
  });
}
