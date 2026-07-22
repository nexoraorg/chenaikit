import { ApiTier, API_TIER_CONFIGS } from '../models/ApiKey';

export type RateLimitWindowName = 'minute' | 'hour' | 'day';

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  algorithm: 'sliding-window';
  failOpen: boolean;
  defaultIpLimit: RateLimitRule;
  tierLimits: Record<ApiTier, RateLimitRule>;
  endpointLimits: Record<string, RateLimitRule>;
  whitelistIps: string[];
  adminBypassToken?: string;
  skipPaths: RegExp[];
}

export const RATE_LIMIT_WINDOWS: Record<RateLimitWindowName, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function endpointRule(method: string, path: string, max: number, windowMs: number): RateLimitRule {
  return { max, windowMs };
}

export function loadRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const enabled =
    env.RATE_LIMIT_ENABLED !== 'false' && env.NODE_ENV !== 'test';

  const defaultIpLimit: RateLimitRule = {
    max: parsePositiveInt(env.RATE_LIMIT_IP_MAX, 100),
    windowMs: parsePositiveInt(env.RATE_LIMIT_IP_WINDOW_MS, RATE_LIMIT_WINDOWS.hour),
  };

  const tierLimits: Record<ApiTier, RateLimitRule> = {
    FREE: {
      max: parsePositiveInt(env.RATE_LIMIT_TIER_FREE_MAX, API_TIER_CONFIGS.FREE.rateLimit.max),
      windowMs: parsePositiveInt(
        env.RATE_LIMIT_TIER_FREE_WINDOW_MS,
        API_TIER_CONFIGS.FREE.rateLimit.windowMs,
      ),
    },
    PRO: {
      max: parsePositiveInt(env.RATE_LIMIT_TIER_PRO_MAX, API_TIER_CONFIGS.PRO.rateLimit.max),
      windowMs: parsePositiveInt(
        env.RATE_LIMIT_TIER_PRO_WINDOW_MS,
        API_TIER_CONFIGS.PRO.rateLimit.windowMs,
      ),
    },
    ENTERPRISE: {
      max: parsePositiveInt(
        env.RATE_LIMIT_TIER_ENTERPRISE_MAX,
        API_TIER_CONFIGS.ENTERPRISE.rateLimit.max,
      ),
      windowMs: parsePositiveInt(
        env.RATE_LIMIT_TIER_ENTERPRISE_WINDOW_MS,
        API_TIER_CONFIGS.ENTERPRISE.rateLimit.windowMs,
      ),
    },
  };

  const endpointLimits: Record<string, RateLimitRule> = {
    'POST /auth/register': endpointRule('POST', '/auth/register', 10, RATE_LIMIT_WINDOWS.minute * 15),
    'POST /auth/login': endpointRule('POST', '/auth/login', 10, RATE_LIMIT_WINDOWS.minute * 15),
    'POST /auth/refresh': endpointRule('POST', '/auth/refresh', 20, RATE_LIMIT_WINDOWS.minute * 15),
    'POST /accounts': endpointRule('POST', '/accounts', 5, RATE_LIMIT_WINDOWS.hour),
  };

  return {
    enabled,
    algorithm: 'sliding-window',
    failOpen: env.RATE_LIMIT_FAIL_OPEN !== 'false',
    defaultIpLimit,
    tierLimits,
    endpointLimits,
    whitelistIps: parseCsv(env.RATE_LIMIT_WHITELIST_IPS).length
      ? parseCsv(env.RATE_LIMIT_WHITELIST_IPS)
      : ['127.0.0.1', '::1'],
    adminBypassToken: env.RATE_LIMIT_ADMIN_BYPASS_TOKEN,
    skipPaths: [
      /\/health(?:\/|$)/,
      /^\/metrics(?:\/|$)/,
      /\/versions(?:\/|$)/,
    ],
  };
}

let cachedConfig: RateLimitConfig | null = null;

export function getRateLimitConfig(): RateLimitConfig {
  if (!cachedConfig) {
    cachedConfig = loadRateLimitConfig();
  }
  return cachedConfig;
}

export function resetRateLimitConfigCache(): void {
  cachedConfig = null;
}
