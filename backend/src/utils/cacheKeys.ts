const APP_PREFIX = 'cak'; // ChenAIKit

function ns(parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p !== undefined && p !== null && `${p}`.length > 0).join(':');
}

export const CacheKeys = {
  accountById: (accountId: string | number) => ns([APP_PREFIX, 'account', accountId]),
  creditScoreByAccount: (accountId: string | number) => ns([APP_PREFIX, 'credit-score', accountId]),
  warming: (name: string) => ns([APP_PREFIX, 'warm', name]),
  metrics: (name: string) => ns([APP_PREFIX, 'metrics', name]),
};

export type CacheKeyBuilder = typeof CacheKeys;


