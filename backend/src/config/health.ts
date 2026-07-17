export interface HealthCheckThresholds {
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  diskUsagePercent: number;
  responseTimeMs: number;
  errorRatePercent: number;
}

export interface HealthAlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  emailRecipients: string[];
  cooldownMs: number;
  severityThresholds: {
    warning: number;
    critical: number;
  };
}

export interface HealthHistoryConfig {
  enabled: boolean;
  maxEntries: number;
  retentionMs: number;
  persistToDisk: boolean;
  filePath: string;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  thresholds: HealthCheckThresholds;
  alerting: HealthAlertConfig;
  history: HealthHistoryConfig;
  checks: {
    database: boolean;
    redis: boolean;
    memory: boolean;
    cpu: boolean;
    disk: boolean;
    externalServices: boolean;
  };
  externalServices: Array<{
    name: string;
    url: string;
    timeoutMs: number;
    expectedStatus?: number;
  }>;
}

const getBooleanFromEnv = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getNumberFromEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseExternalServices = (): HealthCheckConfig['externalServices'] => {
  const raw = process.env.HEALTH_EXTERNAL_SERVICES;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const parseEmailRecipients = (): string[] => {
  const raw = process.env.HEALTH_ALERT_EMAILS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
};

export const getHealthConfig = (): HealthCheckConfig => ({
  enabled: getBooleanFromEnv('HEALTH_CHECK_ENABLED', true),
  intervalMs: getNumberFromEnv('HEALTH_CHECK_INTERVAL', 30_000),
  timeoutMs: getNumberFromEnv('HEALTH_CHECK_TIMEOUT', 5_000),

  thresholds: {
    memoryUsagePercent: getNumberFromEnv('HEALTH_THRESHOLD_MEMORY', 85),
    cpuUsagePercent: getNumberFromEnv('HEALTH_THRESHOLD_CPU', 80),
    diskUsagePercent: getNumberFromEnv('HEALTH_THRESHOLD_DISK', 90),
    responseTimeMs: getNumberFromEnv('HEALTH_THRESHOLD_RESPONSE_TIME', 2_000),
    errorRatePercent: getNumberFromEnv('HEALTH_THRESHOLD_ERROR_RATE', 5),
  },

  alerting: {
    enabled: getBooleanFromEnv('HEALTH_ALERTING_ENABLED', false),
    webhookUrl: process.env.HEALTH_ALERT_WEBHOOK_URL,
    webhookSecret: process.env.HEALTH_ALERT_WEBHOOK_SECRET,
    emailRecipients: parseEmailRecipients(),
    cooldownMs: getNumberFromEnv('HEALTH_ALERT_COOLDOWN', 300_000), // 5 minutes
    severityThresholds: {
      warning: getNumberFromEnv('HEALTH_ALERT_WARNING_SCORE', 60),
      critical: getNumberFromEnv('HEALTH_ALERT_CRITICAL_SCORE', 30),
    },
  },

  history: {
    enabled: getBooleanFromEnv('HEALTH_HISTORY_ENABLED', true),
    maxEntries: getNumberFromEnv('HEALTH_HISTORY_MAX_ENTRIES', 100),
    retentionMs: getNumberFromEnv('HEALTH_HISTORY_RETENTION_MS', 24 * 60 * 60 * 1_000), // 24 hours
    persistToDisk: getBooleanFromEnv('HEALTH_HISTORY_PERSIST', false),
    filePath: process.env.HEALTH_HISTORY_FILE_PATH || 'logs/health-history.json',
  },

  checks: {
    database: getBooleanFromEnv('HEALTH_CHECK_DATABASE', true),
    redis: getBooleanFromEnv('HEALTH_CHECK_REDIS', true),
    memory: getBooleanFromEnv('HEALTH_CHECK_MEMORY', true),
    cpu: getBooleanFromEnv('HEALTH_CHECK_CPU', true),
    disk: getBooleanFromEnv('HEALTH_CHECK_DISK', true),
    externalServices: getBooleanFromEnv('HEALTH_CHECK_EXTERNAL', false),
  },

  externalServices: parseExternalServices(),
});
