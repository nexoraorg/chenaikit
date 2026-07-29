/**
 * Centralized logging configuration
 * Supports console, file, and external service transports.
 */
export interface ExternalLogServiceConfig {
  enabled: boolean;
  /** HTTP endpoint to POST log entries (Loggly, Datadog, custom SIEM, etc.) */
  url?: string;
  /** Bearer / API token sent in Authorization header */
  token?: string;
  /** Additional static tags appended to every log entry */
  tags?: string[];
  /** Minimum level to forward: 'debug'|'info'|'warn'|'error' */
  minLevel?: string;
  /** Batch size before flushing to the endpoint */
  batchSize?: number;
  /** Max ms to wait before flushing an incomplete batch */
  flushIntervalMs?: number;
}

export interface LoggingConfig {
  level: string;
  format: 'json' | 'simple';
  console: boolean;
  file: boolean;
  filePath: string;
  errorFilePath: string;
  maxFiles: number;
  maxSize: string;
  /** 0–1 fraction of requests to log at debug level (1 = all, 0 = none) */
  samplingRate: number;
  externalService: ExternalLogServiceConfig;
}

function getBool(key: string, def: boolean): boolean {
  const v = process.env[key];
  return v === undefined ? def : v.toLowerCase() === 'true';
}

function getNum(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined) return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

export const loggingConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT === 'simple' ? 'simple' : 'json',
  console: getBool('LOG_CONSOLE', true),
  file: getBool('LOG_FILE', process.env.NODE_ENV === 'production'),
  filePath: process.env.LOG_FILE_PATH || 'logs/app.log',
  errorFilePath: process.env.LOG_ERROR_FILE_PATH || 'logs/error.log',
  maxFiles: getNum('LOG_MAX_FILES', 14),
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  samplingRate: getNum('LOG_SAMPLING_RATE', 1),
  externalService: {
    enabled: getBool('LOG_EXTERNAL_ENABLED', false),
    url: process.env.LOG_EXTERNAL_URL,
    token: process.env.LOG_EXTERNAL_TOKEN,
    tags: process.env.LOG_EXTERNAL_TAGS ? process.env.LOG_EXTERNAL_TAGS.split(',') : [],
    minLevel: process.env.LOG_EXTERNAL_MIN_LEVEL || 'warn',
    batchSize: getNum('LOG_EXTERNAL_BATCH_SIZE', 10),
    flushIntervalMs: getNum('LOG_EXTERNAL_FLUSH_MS', 5000),
  },
};
