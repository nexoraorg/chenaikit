export interface FeatureFlagConfig {
  pollingInterval: number;
  cacheTTL: number;
  defaultFlags: Record<string, boolean>;
  auditRetentionDays: number;
}

export const getFeatureFlagConfig = (): FeatureFlagConfig => {
  return {
    pollingInterval: Number(process.env.FF_POLLING_INTERVAL) || 30000,
    cacheTTL: Number(process.env.FF_CACHE_TTL) || 60000,
    defaultFlags: {},
    auditRetentionDays: Number(process.env.FF_AUDIT_RETENTION_DAYS) || 90,
  };
};
