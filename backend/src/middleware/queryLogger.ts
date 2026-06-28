import { Prisma } from '@prisma/client';
import { QueryMetrics } from '../utils/queryUtils';

/**
 * Query logging configuration
 */
export interface QueryLoggerConfig {
  enabled: boolean;
  logSlowQueries: boolean;
  slowQueryThreshold: number; // in milliseconds
  logAllQueries: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  includeQueryParams: boolean;
  maxQueryLength: number;
}

/**
 * Query log entry
 */
export interface QueryLogEntry {
  timestamp: Date;
  query: string;
  params?: any;
  duration: number;
  model: string;
  action: string;
  success: boolean;
  error?: string;
  recordCount?: number;
}

/**
 * Query statistics
 */
export interface QueryStatistics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  slowQueries: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  queriesByModel: Record<string, number>;
  queriesByAction: Record<string, number>;
}

/**
 * Query Logger for monitoring and analyzing database queries
 */
export class QueryLogger {
  private config: QueryLoggerConfig;
  private queryLogs: QueryLogEntry[] = [];
  private statistics: QueryStatistics;
  private maxLogEntries: number = 1000;

  constructor(config?: Partial<QueryLoggerConfig>) {
    this.config = {
      enabled: true,
      logSlowQueries: true,
      slowQueryThreshold: 1000, // 1 second
      logAllQueries: false,
      logLevel: 'info',
      includeQueryParams: false,
      maxQueryLength: 500,
      ...config,
    };

    this.statistics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      queriesByModel: {},
      queriesByAction: {},
    };
  }

  /**
   * Log a query execution
   */
  logQuery(entry: QueryLogEntry): void {
    if (!this.config.enabled) {
      return;
    }

    // Update statistics
    this.updateStatistics(entry);

    // Determine if we should log this query
    const shouldLog = this.shouldLogQuery(entry);

    if (shouldLog) {
      // Truncate query if too long
      const truncatedQuery = this.truncateQuery(entry.query);
      const logEntry = {
        ...entry,
        query: truncatedQuery,
      };

      // Add to logs
      this.queryLogs.push(logEntry);

      // Keep only recent logs
      if (this.queryLogs.length > this.maxLogEntries) {
        this.queryLogs.shift();
      }

      // Log to console based on log level
      this.logToConsole(logEntry);
    }
  }

  /**
   * Get recent query logs
   */
  getQueryLogs(limit: number = 100): QueryLogEntry[] {
    return this.queryLogs.slice(-limit);
  }

  /**
   * Get query statistics
   */
  getStatistics(): QueryStatistics {
    return { ...this.statistics };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold?: number): QueryLogEntry[] {
    const slowThreshold = threshold || this.config.slowQueryThreshold;
    return this.queryLogs.filter(entry => entry.duration >= slowThreshold);
  }

  /**
   * Get failed queries
   */
  getFailedQueries(): QueryLogEntry[] {
    return this.queryLogs.filter(entry => !entry.success);
  }

  /**
   * Clear query logs
   */
  clearLogs(): void {
    this.queryLogs = [];
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      queriesByModel: {},
      queriesByAction: {},
    };
  }

  /**
   * Generate a performance report
   */
  generateReport(): {
    statistics: QueryStatistics;
    slowQueries: QueryLogEntry[];
    failedQueries: QueryLogEntry[];
    recommendations: string[];
  } {
    const slowQueries = this.getSlowQueries();
    const failedQueries = this.getFailedQueries();
    const recommendations = this.generateRecommendations();

    return {
      statistics: this.getStatistics(),
      slowQueries,
      failedQueries,
      recommendations,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueryLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Determine if a query should be logged
   */
  private shouldLogQuery(entry: QueryLogEntry): boolean {
    // Always log failed queries
    if (!entry.success) {
      return true;
    }

    // Log slow queries if enabled
    if (this.config.logSlowQueries && entry.duration >= this.config.slowQueryThreshold) {
      return true;
    }

    // Log all queries if enabled
    if (this.config.logAllQueries) {
      return true;
    }

    return false;
  }

  /**
   * Update statistics based on query entry
   */
  private updateStatistics(entry: QueryLogEntry): void {
    this.statistics.totalQueries++;

    if (entry.success) {
      this.statistics.successfulQueries++;
    } else {
      this.statistics.failedQueries++;
    }

    if (entry.duration >= this.config.slowQueryThreshold) {
      this.statistics.slowQueries++;
    }

    // Update duration statistics
    this.statistics.maxDuration = Math.max(this.statistics.maxDuration, entry.duration);
    this.statistics.minDuration = Math.min(this.statistics.minDuration, entry.duration);
    
    const totalDuration = this.statistics.averageDuration * (this.statistics.totalQueries - 1);
    this.statistics.averageDuration = (totalDuration + entry.duration) / this.statistics.totalQueries;

    // Update model and action counts
    this.statistics.queriesByModel[entry.model] = (this.statistics.queriesByModel[entry.model] || 0) + 1;
    this.statistics.queriesByAction[entry.action] = (this.statistics.queriesByAction[entry.action] || 0) + 1;
  }

  /**
   * Truncate query string if too long
   */
  private truncateQuery(query: string): string {
    if (query.length <= this.config.maxQueryLength) {
      return query;
    }
    return query.substring(0, this.config.maxQueryLength) + '...';
  }

  /**
   * Log entry to console
   */
  private logToConsole(entry: QueryLogEntry): void {
    const logMethod = this.getLogMethod();
    const message = `[Query Logger] ${entry.model}.${entry.action} - ${entry.duration}ms`;

    const logData: any = {
      duration: entry.duration,
      success: entry.success,
      recordCount: entry.recordCount,
    };

    if (this.config.includeQueryParams && entry.params) {
      logData.params = entry.params;
    }

    if (!entry.success && entry.error) {
      logData.error = entry.error;
    }

    if (entry.duration >= this.config.slowQueryThreshold) {
      logData.warning = 'Slow query detected';
    }

    console[logMethod](message, logData);
  }

  /**
   * Get console log method based on log level
   */
  private getLogMethod(): 'log' | 'debug' | 'info' | 'warn' | 'error' {
    const levelMap: Record<string, 'log' | 'debug' | 'info' | 'warn' | 'error'> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
    };
    return levelMap[this.config.logLevel] || 'log';
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for high failure rate
    if (this.statistics.totalQueries > 0) {
      const failureRate = this.statistics.failedQueries / this.statistics.totalQueries;
      if (failureRate > 0.05) {
        recommendations.push(`High query failure rate detected (${(failureRate * 100).toFixed(1)}%). Review error logs.`);
      }
    }

    // Check for high slow query rate
    if (this.statistics.totalQueries > 0) {
      const slowRate = this.statistics.slowQueries / this.statistics.totalQueries;
      if (slowRate > 0.1) {
        recommendations.push(`High slow query rate detected (${(slowRate * 100).toFixed(1)}%). Consider adding indexes or optimizing queries.`);
      }
    }

    // Check for very slow queries
    const verySlowQueries = this.getSlowQueries(this.config.slowQueryThreshold * 2);
    if (verySlowQueries.length > 0) {
      recommendations.push(`${verySlowQueries.length} queries took more than ${this.config.slowQueryThreshold * 2}ms. Review these queries for optimization opportunities.`);
    }

    // Check average duration
    if (this.statistics.averageDuration > 500) {
      recommendations.push(`Average query duration is ${this.statistics.averageDuration.toFixed(0)}ms. Consider overall query optimization.`);
    }

    // Identify most queried models
    const modelCounts = Object.entries(this.statistics.queriesByModel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (modelCounts.length > 0 && modelCounts[0][1] > 100) {
      const topModel = modelCounts[0];
      recommendations.push(`Model '${topModel[0]}' is queried frequently (${topModel[1]} times). Consider caching strategies.`);
    }

    return recommendations;
  }
}

/**
 * Prisma middleware for query logging
 */
export function createQueryLoggingMiddleware(logger: QueryLogger) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>
  ) => {
    const startTime = Date.now();
    const model = params.model!;
    const action = params.action;

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      // Determine record count
      let recordCount = 0;
      if (Array.isArray(result)) {
        recordCount = result.length;
      } else if (result && typeof result === 'object') {
        if ('count' in result) {
          recordCount = (result as any).count;
        } else {
          recordCount = 1;
        }
      }

      logger.logQuery({
        timestamp: new Date(),
        query: `${}.${action}`,
        params: logger.config.includeQueryParams ? params.args : undefined,
        duration,
        model,
        action,
        success: true,
        recordCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.logQuery({
        timestamp: new Date(),
        query: `${model}.${action}`,
        params: logger.config.includeQueryParams ? params.args : undefined,
        duration,
        model,
        action,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}

/**
 * Create a query logger with default configuration
 */
export function createQueryLogger(config?: Partial<QueryLoggerConfig>): QueryLogger {
  return new QueryLogger(config);
}

/**
 * Export singleton instance
 */
export const defaultQueryLogger = createQueryLogger({
  enabled: process.env.NODE_ENV !== 'test',
  logSlowQueries: true,
  slowQueryThreshold: 1000,
  logAllQueries: process.env.NODE_ENV === 'development',
  logLevel: 'info',
  includeQueryParams: false,
  maxQueryLength: 500,
});
