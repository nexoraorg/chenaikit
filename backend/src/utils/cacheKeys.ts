import { buildCacheKey } from './cacheUtils';

/**
 * Centralized cache key builders for all domains.
 * Use these instead of hardcoding keys to ensure consistency.
 */
export const CacheKeys = {
  // ─── Account ──────────────────────────────────
  accountById: (accountId: string | number) =>
    buildCacheKey(['account', accountId]),
  accountByEmail: (email: string) =>
    buildCacheKey(['account', 'email', email]),
  accountList: (page: number, limit: number) =>
    buildCacheKey(['account', 'list', page, limit]),

  // ─── Credit Score ─────────────────────────────
  creditScoreByAccount: (accountId: string | number) =>
    buildCacheKey(['credit-score', accountId]),
  creditScoreHistory: (accountId: string | number) =>
    buildCacheKey(['credit-score', 'history', accountId]),

  // ─── Fraud Detection ──────────────────────────
  fraudAlertById: (alertId: string) =>
    buildCacheKey(['fraud-alert', alertId]),
  fraudAlertsByAccount: (accountId: string | number) =>
    buildCacheKey(['fraud-alert', 'account', accountId]),

  // ─── Transactions ─────────────────────────────
  transactionById: (txId: string) =>
    buildCacheKey(['tx', txId]),
  transactionsByAccount: (accountId: string | number, page: number) =>
    buildCacheKey(['tx', 'account', accountId, page]),

  // ─── Analytics ────────────────────────────────
  dashboardSummary: (startDate: string, endDate: string) =>
    buildCacheKey(['analytics', 'dashboard', startDate, endDate]),
  trafficTrends: (days: number) =>
    buildCacheKey(['analytics', 'trends', days]),
  forecast: (days: number) =>
    buildCacheKey(['analytics', 'forecast', days]),

  // ─── Health / Monitoring ──────────────────────
  healthStatus: () => buildCacheKey(['health']),
  metrics: (name: string) => buildCacheKey(['metrics', name]),

  // ─── User / Auth ──────────────────────────────
  userById: (userId: string | number) =>
    buildCacheKey(['user', userId]),
  userSession: (sessionId: string) =>
    buildCacheKey(['session', sessionId]),
  apiKeyByHash: (hash: string) =>
    buildCacheKey(['apikey', hash]),

  // ─── Feature Flags ────────────────────────────
  featureFlags: () => buildCacheKey(['feature-flags']),
  featureFlag: (flagName: string) =>
    buildCacheKey(['feature-flag', flagName]),

  // ─── Cache Internals ──────────────────────────
  warming: (name: string) =>
    buildCacheKey(['warm', name]),
} as const;

export type CacheKeyBuilder = typeof CacheKeys;
