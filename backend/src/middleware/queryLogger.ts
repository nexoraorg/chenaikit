/**
 * Query Logger Middleware
 * 
 * This middleware logs all database queries for monitoring, debugging,
 * and performance analysis. It integrates with Prisma's query logging.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { queryMonitor } from '../utils/queryUtils';

export interface QueryLogEntry {
  query: string;
  params: any;
  duration: number;
  timestamp: Date;
  requestId?: string;
}

export class QueryLogger {
  private logs: QueryLogEntry[] = [];
  private maxLogs = 1000;
  private slowQueryThreshold = 1000; // 1 second
  private enabled = true;

  constructor(private prisma: PrismaClient) {
    this.setupPrismaLogging();
  }

  /**
   * Enable or disable query logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the slow query threshold in milliseconds
   */
  setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }

  /**
   * Setup Prisma query logging
   */
  private setupPrismaLogging(): void {
    this.prisma.$use(async (params, next) => {
      if (!this.enabled) {
        return next(params);
      }

      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      const query = this.formatQuery(params);
      
      this.logQuery({
        query,
        params: params.args,
        duration,
        timestamp: new Date()
      });

      // Monitor performance
      queryMonitor.record(query, duration);

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        log.warn(`Slow query detected (${duration}ms)`, {
          query,
          params: params.args,
          model: params.model,
          action: params.action
        });
      }

      return result;
    });
  }

  /**
   * Format Prisma query parameters into a readable string
   */
  private formatQuery(params: any): string {
    const { model, action, args } = params;
    return `${model}.${action} ${JSON.stringify(args)}`;
  }

  /**
   * Log a query entry
   */
  private logQuery(entry: QueryLogEntry): void {
    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get all query logs
   */
  getLogs(): QueryLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get slow query logs
   */
  getSlowQueries(threshold?: number): QueryLogEntry[] {
    const limit = threshold || this.slowQueryThreshold;
    return this.logs.filter(log => log.duration > limit);
  }

  /**
   * Get query statistics
   */
  getStatistics() {
    const totalQueries = this.logs.length;
    const totalDuration = this.logs.reduce((sum, log) => sum + log.duration, 0);
    const avgDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;
    const slowQueries = this.getSlowQueries().length;

    return {
      totalQueries,
      totalDuration,
      avgDuration,
      slowQueries,
      slowQueryThreshold: this.slowQueryThreshold
    };
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get logs grouped by model
   */
  getLogsByModel(): Record<string, QueryLogEntry[]> {
    const grouped: Record<string, QueryLogEntry[]> = {};

    for (const log of this.logs) {
      const model = this.extractModel(log.query);
      if (!grouped[model]) {
        grouped[model] = [];
      }
      grouped[model].push(log);
    }

    return grouped;
  }

  /**
   * Extract model name from query string
   */
  private extractModel(query: string): string {
    const match = query.match(/^(\w+)\./);
    return match ? match[1] : 'unknown';
  }

  /**
   * Get logs grouped by action
   */
  getLogsByAction(): Record<string, QueryLogEntry[]> {
    const grouped: Record<string, QueryLogEntry[]> = {};

    for (const log of this.logs) {
      const action = this.extractAction(log.query);
      if (!grouped[action]) {
        grouped[action] = [];
      }
      grouped[action].push(log);
    }

    return grouped;
  }

  /**
   * Extract action name from query string
   */
  private extractAction(query: string): string {
    const match = query.match(/^\w+\.(\w+)/);
    return match ? match[1] : 'unknown';
  }
}

/**
 * Express middleware to add request ID to query logs
 */
export function queryLoggerMiddleware(
  queryLogger: QueryLogger
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.id || Date.now().toString();
    
    // Store request ID for query logger
    (req as any).queryLogger = queryLogger;
    (req as any).requestId = requestId;

    // Log query statistics at the end of request
    const originalSend = res.send;
    res.send = function (data) {
      const stats = queryLogger.getStatistics();
      if (stats.totalQueries > 0) {
        log.info('Request query statistics', {
          requestId,
          ...stats
        });
      }
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Create a query logger instance
 */
export function createQueryLogger(prisma: PrismaClient): QueryLogger {
  return new QueryLogger(prisma);
}
