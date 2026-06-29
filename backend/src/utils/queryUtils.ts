/**
 * Query Utilities for Database Optimization
 * 
 * This module provides helper functions for optimizing database queries,
 * including batch operations, query deduplication, and performance monitoring.
 */

import { PrismaClient } from '@prisma/client';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
}

export interface QueryOptions {
  cacheKey?: string;
  cacheTTL?: number;
  batchSize?: number;
  skipCache?: boolean;
}

/**
 * Query cache for storing frequently accessed data
 */
class QueryCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  
  set(key: string, data: any, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const queryCache = new QueryCache();

/**
 * Batch operation helper for processing multiple items efficiently
 */
export async function batchOperation<T, R>(
  items: T[],
  batchSize: number,
  operation: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await operation(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Query deduplication to prevent duplicate queries in the same request
 */
class QueryDeduplicator {
  private pendingQueries = new Map<string, Promise<any>>();
  
  async execute<T>(
    key: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    if (this.pendingQueries.has(key)) {
      return this.pendingQueries.get(key)!;
    }
    
    const promise = queryFn();
    this.pendingQueries.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingQueries.delete(key);
    }
  }
  
  clear(): void {
    this.pendingQueries.clear();
  }
}

export const queryDeduplicator = new QueryDeduplicator();

/**
 * Performance monitoring for queries
 */
export class QueryMonitor {
  private metrics: QueryMetrics[] = [];
  private maxMetrics = 1000;
  private slowQueryThreshold = 1000; // 1 second
  
  record(query: string, duration: number, rowCount?: number): void {
    const metric: QueryMetrics = {
      query,
      duration,
      timestamp: new Date(),
      rowCount
    };
    
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
    
    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected (${duration}ms): ${query}`);
    }
  }
  
  getMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }
  
  getSlowQueries(threshold?: number): QueryMetrics[] {
    const limit = threshold || this.slowQueryThreshold;
    return this.metrics.filter(m => m.duration > limit);
  }
  
  getAverageQueryTime(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / this.metrics.length;
  }
  
  clear(): void {
    this.metrics = [];
  }
  
  setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }
}

export const queryMonitor = new QueryMonitor();

/**
 * Wrapper function for executing queries with monitoring and caching
 */
export async function executeQuery<T>(
  prisma: PrismaClient,
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const { cacheKey, cacheTTL = 60000, skipCache = false } = options;
  
  // Check cache if key is provided and not skipping cache
  if (cacheKey && !skipCache) {
    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }
  
  const startTime = Date.now();
  let result: T;
  
  try {
    result = await queryFn();
  } catch (error) {
    const duration = Date.now() - startTime;
    queryMonitor.record('Query Error', duration);
    throw error;
  }
  
  const duration = Date.now() - startTime;
  queryMonitor.record('Query Execution', duration);
  
  // Cache result if key is provided
  if (cacheKey && result !== null) {
    queryCache.set(cacheKey, result, cacheTTL);
  }
  
  return result;
}

/**
 * Helper for creating efficient date range queries
 */
export function createDateRangeFilter(
  startDate?: Date,
  endDate?: Date
): { gte?: Date; lte?: Date } {
  const filter: { gte?: Date; lte?: Date } = {};
  
  if (startDate) {
    filter.gte = startDate;
  }
  
  if (endDate) {
    filter.lte = endDate;
  }
  
  return filter;
}

/**
 * Helper for pagination
 */
export function createPaginationParams(
  page: number = 1,
  pageSize: number = 10
) {
  const skip = (page - 1) * pageSize;
  return {
    skip,
    take: pageSize
  };
}

/**
 * Helper for creating efficient select statements
 */
export function createSelect<T extends Record<string, boolean>>(
  fields: T
): T {
  return fields;
}

/**
 * Helper for creating efficient include statements with nested relations
 */
export function createInclude<T extends Record<string, any>>(
  relations: T
): T {
  return relations;
}

/**
 * Clear expired cache entries periodically
 */
export function startCacheCleanup(interval: number = 60000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    queryCache.clearExpired();
  }, interval);
}

/**
 * Get query statistics
 */
export function getQueryStatistics() {
  return {
    totalQueries: queryMonitor.getMetrics().length,
    slowQueries: queryMonitor.getSlowQueries().length,
    averageQueryTime: queryMonitor.getAverageQueryTime(),
    cacheSize: queryCache['cache'].size
  };
}
