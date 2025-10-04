import winston from 'winston';
import { monitoringConfig, isProduction } from '../config/monitoring';
import { LogContext } from '../types/monitoring';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  winston.format.json()
);

// Simple format for development
const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}` ;
  })
);

// Create transports
const transports: winston.transport[] = [];

if (monitoringConfig.logging.console) {
  transports.push(
    new winston.transports.Console({
      format: monitoringConfig.logging.format === 'json' ? structuredFormat : simpleFormat,
    })
  );
}

if (monitoringConfig.logging.file) {
  transports.push(
    new winston.transports.File({
      filename: monitoringConfig.logging.filePath!.replace('.log', '-error.log'),
      level: 'error',
      maxsize: parseSize(monitoringConfig.logging.maxSize!),
      maxFiles: monitoringConfig.logging.maxFiles,
      format: structuredFormat,
    }),
    new winston.transports.File({
      filename: monitoringConfig.logging.filePath!,
      maxsize: parseSize(monitoringConfig.logging.maxSize!),
      maxFiles: monitoringConfig.logging.maxFiles,
      format: structuredFormat,
    })
  );
}

// Helper to parse size string (e.g., '20m' to bytes)
function parseSize(size: string): number {
  const units: Record<string, number> = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 };
  const match = size.toLowerCase().match(/^(\d+)([kmg])?$/);
  if (!match) return 20 * 1024 * 1024; // Default 20MB
  const value = parseInt(match[1]);
  const unit = match[2] || '';
  return value * (units[unit] || 1);
}

// Create logger instance
const logger = winston.createLogger({
  level: monitoringConfig.logging.level,
  defaultMeta: {
    service: monitoringConfig.metrics.defaultLabels?.service,
    environment: monitoringConfig.metrics.defaultLabels?.environment,
  },
  transports,
  exitOnError: false,
});

// Structured logging wrapper
class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private log(level: string, message: string, meta?: LogContext): void {
    logger.log(level, message, { ...this.context, ...meta });
  }

  debug(message: string, meta?: LogContext): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogContext): void {
    this.log('info', message, meta);
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

  // HTTP request logging
  http(message: string, meta: LogContext): void {
    this.log('http', message, meta);
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: LogContext): void {
    this.info(`Performance: ${operation}` , {
      operation,
      duration,
      unit: 'ms',
      ...meta,
    });

    // Warn on slow operations
    if (duration > 1000) {
      this.warn(`Slow operation detected: ${operation}` , {
        operation,
        duration,
        threshold: 1000,
        ...meta,
      });
    }
  }

  // Security event logging
  security(event: string, meta?: LogContext): void {
    this.warn(`Security Event: ${event}` , {
      securityEvent: true,
      event,
      ...meta,
    });
  }

  // Audit logging
  audit(action: string, meta?: LogContext): void {
    this.info(`Audit: ${action}` , {
      audit: true,
      action,
      ...meta,
    });
  }

  // Create child logger with additional context
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}

// Timer utility for performance measurement
export class Timer {
  private startTime: number;
  private operation: string;
  private logger: Logger;

  constructor(operation: string, contextLogger?: Logger) {
    this.operation = operation;
    this.startTime = Date.now();
    this.logger = contextLogger || log;
  }

  end(meta?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(this.operation, duration, meta);
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
      this.logger.error(`Operation failed: ${this.operation}` 
, error as Error, {
        ...meta,
        duration,
        success: false,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const log = new Logger();

// Export logger for stream usage (e.g., morgan)
export const stream = {
  write: (message: string) => {
    log.http(message.trim(), {});
  },
};

// Export base logger for advanced usage
export { logger as winstonLogger };
