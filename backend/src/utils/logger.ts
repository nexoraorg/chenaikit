import winston from 'winston';
import { Writable } from 'stream';
import { monitoringConfig } from '../config/monitoring';
import { loggingConfig, ExternalLogServiceConfig } from '../config/logging';
import { LogContext } from '../types/monitoring';
import { redact } from './logRedaction';

// ---------------------------------------------------------------------------
// External HTTP transport (Loggly, Datadog, SIEM, etc.)
// ---------------------------------------------------------------------------

interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<string, number> = {
  debug: 0,
  http: 1,
  info: 2,
  warn: 3,
  error: 4,
};

class HttpLogTransport extends Writable {
  public level?: string;
  public silent?: boolean;
  private readonly cfg: ExternalLogServiceConfig;
  private batch: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(cfg: ExternalLogServiceConfig) {
    super({ objectMode: true });
    this.cfg = cfg;
    if (cfg.flushIntervalMs && cfg.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => this.flush(), cfg.flushIntervalMs);
      if (this.flushTimer.unref) this.flushTimer.unref(); // don't block process exit
    }
  }

  _write(info: LogEntry, _encoding: string, callback: () => void): void {
    this.log(info, callback);
  }

  private meetsMinLevel(level: string): boolean {
    const min = this.cfg.minLevel || 'warn';
    return (LEVEL_ORDER[level] ?? 99) >= (LEVEL_ORDER[min] ?? 0);
  }

  log(info: LogEntry, callback: () => void): void {
    if (!this.cfg.enabled || !this.cfg.url || !this.meetsMinLevel(info.level)) {
      callback();
      return;
    }

    this.batch.push({
      ...info,
      tags: this.cfg.tags,
      service: monitoringConfig.metrics.defaultLabels?.service,
      environment: monitoringConfig.metrics.defaultLabels?.environment,
    });

    if (this.batch.length >= (this.cfg.batchSize || 10)) {
      this.flush();
    }

    callback();
  }

  private flush(): void {
    if (this.batch.length === 0 || !this.cfg.url) return;
    const entries = this.batch.splice(0);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.token) headers['Authorization'] = `Bearer ${this.cfg.token}`;

    // Fire-and-forget; never throws into the app
    fetch(this.cfg.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(entries),
    }).catch(() => {
      // intentionally swallowed – logging must never crash the app
    });
  }

  close(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}

// ---------------------------------------------------------------------------
// Winston formats
// ---------------------------------------------------------------------------

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

function parseSize(size: string): number {
  const units: Record<string, number> = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 };
  const match = size.toLowerCase().match(/^(\d+)([kmg])?$/);
  if (!match) return 20 * 1024 * 1024;
  return parseInt(match[1]) * (units[match[2]] || 1);
}

const transports: winston.transport[] = [];

if (loggingConfig.console) {
  transports.push(
    new winston.transports.Console({
      format: loggingConfig.format === 'json' ? structuredFormat : simpleFormat,
    })
  );
}

if (loggingConfig.file) {
  transports.push(
    new winston.transports.File({
      filename: loggingConfig.errorFilePath,
      level: 'error',
      maxsize: parseSize(loggingConfig.maxSize),
      maxFiles: loggingConfig.maxFiles,
      format: structuredFormat,
    }),
    new winston.transports.File({
      filename: loggingConfig.filePath,
      maxsize: parseSize(loggingConfig.maxSize),
      maxFiles: loggingConfig.maxFiles,
      format: structuredFormat,
    })
  );
}

if (loggingConfig.externalService.enabled) {
  transports.push(new HttpLogTransport(loggingConfig.externalService) as unknown as winston.transport);
}

// ---------------------------------------------------------------------------
// Core winston instance
// ---------------------------------------------------------------------------

const winstonLogger = winston.createLogger({
  level: loggingConfig.level,
  defaultMeta: {
    service: monitoringConfig.metrics.defaultLabels?.service,
    environment: monitoringConfig.metrics.defaultLabels?.environment,
  },
  transports,
  exitOnError: false,
});

// ---------------------------------------------------------------------------
// Structured Logger wrapper
// ---------------------------------------------------------------------------

export class Logger {
  private context: LogContext = {};
  /** 0–1 sampling rate; 1 = log everything */
  private samplingRate: number;

  constructor(samplingRate = loggingConfig.samplingRate) {
    this.samplingRate = samplingRate;
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private shouldSample(): boolean {
    return this.samplingRate >= 1 || Math.random() < this.samplingRate;
  }

  private sanitize(meta?: LogContext): LogContext | undefined {
    return meta ? (redact(meta) as LogContext) : meta;
  }

  private log(level: string, message: string, meta?: LogContext): void {
    winstonLogger.log(level, message, { ...this.context, ...this.sanitize(meta) });
  }

  debug(message: string, meta?: LogContext): void {
    if (this.shouldSample()) this.log('debug', message, meta);
  }

  info(message: string, meta?: LogContext): void {
    if (this.shouldSample()) this.log('info', message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | LogContext, meta?: LogContext): void {
    const errorMeta = error instanceof Error
      ? { error: { message: error.message, stack: error.stack, name: error.name }, ...meta }
      : { ...error, ...meta };
    this.log('error', message, errorMeta);
  }

  http(message: string, meta: LogContext): void {
    if (this.shouldSample()) this.log('http', message, meta);
  }

  performance(operation: string, duration: number, meta?: LogContext): void {
    this.info(`Performance: ${operation}`, { operation, duration, unit: 'ms', ...meta });
    if (duration > 1000) {
      this.warn(`Slow operation detected: ${operation}`, {
        operation, duration, threshold: 1000, ...meta,
      });
    }
  }

  security(event: string, meta?: LogContext): void {
    this.warn(`Security Event: ${event}`, { securityEvent: true, event, ...meta });
  }

  audit(action: string, meta?: LogContext): void {
    // Audit logs always emitted regardless of sampling
    this.log('info', `Audit: ${action}`, { audit: true, action, ...meta });
  }

  child(context: LogContext): Logger {
    const child = new Logger(this.samplingRate);
    child.setContext({ ...this.context, ...context });
    return child;
  }
}

// ---------------------------------------------------------------------------
// Timer utility
// ---------------------------------------------------------------------------

export class Timer {
  private startTime: number;
  private operation: string;
  private contextLogger: Logger;

  constructor(operation: string, contextLogger?: Logger) {
    this.operation = operation;
    this.startTime = Date.now();
    this.contextLogger = contextLogger || log;
  }

  end(meta?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.contextLogger.performance(this.operation, duration, meta);
    return duration;
  }

  endWithResult<T>(result: T, meta?: LogContext): T {
    this.end(meta);
    return result;
  }

  async endAsync<T>(promise: Promise<T>, meta?: LogContext): Promise<T> {
    try {
      const result = await promise;
      this.end({ ...meta, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - this.startTime;
      this.contextLogger.error(`Operation failed: ${this.operation}`, error as Error, {
        ...meta, duration, success: false,
      });
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const log = new Logger();

export const stream = {
  write: (message: string) => {
    log.http(message.trim(), {});
  },
};

export { winstonLogger };
