import { QueryLogger, QueryLogEntry } from '../middleware/queryLogger';

/**
 * Query optimization configuration
 */
export interface QueryOptimizerConfig {
  enabled: boolean;
  autoOptimize: boolean;
  suggestIndexes: boolean;
  analyzeNPlusOne: boolean;
  cacheResults: boolean;
  cacheTTL: number; // in milliseconds
}

/**
 * Query optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'n_plus_one' | 'cache' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  query?: string;
  recommendation: string;
  impact?: string;
}

/**
 * N+1 query detection result
 */
export interface NPlusOneDetection {
  detected: boolean;
  pattern: string;
  affectedQueries: string[];
  suggestedSolution: string;
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  query: string;
  executionCount: number;
  averageDuration: number;
  totalDuration: number;
  suggestions: OptimizationSuggestion[];
  nPlusOneIssues: NPlusOneDetection[];
}

/**
 * Query Optimizer for analyzing and optimizing database queries
 */
export class QueryOptimizer {
  private config: QueryOptimizerConfig;
  private queryLogger: QueryLogger;
  private queryCache: Map<string, { data: any; timestamp: number }>;
  private analyzedQueries: Map<string, QueryAnalysis>;

  constructor(
    queryLogger: QueryLogger,
    config?: Partial<QueryOptimizerConfig>
  ) {
    this.config = {
      enabled: true,
      autoOptimize: false,
      suggestIndexes: true,
      analyzeNPlusOne: true,
      cacheResults: false,
      cacheTTL: 60000, // 1 minute
      ...config,
    };

    this.queryLogger = queryLogger;
    this.queryCache = new Map();
    this.analyzedQueries = new Map();
  }

  /**
   * Analyze query logs for optimization opportunities
   */
  analyzeQueries(): QueryAnalysis[] {
    if (!this.config.enabled) {
      return [];
    }

    const logs = this.queryLogger.getQueryLogs();
    const queryGroups = this.groupQueries(logs);
    const analyses: QueryAnalysis[] = [];

    for (const [queryKey, queryLogs] of queryGroups.entries()) {
      const analysis = this.analyzeQueryGroup(queryKey, queryLogs);
      analyses.push(analysis);
      this.analyzedQueries.set(queryKey, analysis);
    }

    return analyses;
  }

  /**
   * Get optimization suggestions for all queries
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const analyses = this.analyzeQueries();
    const suggestions: OptimizationSuggestion[] = [];

    for (const analysis of analyses) {
      suggestions.push(...analysis.suggestions);
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return suggestions;
  }

  /**
   * Detect N+1 query problems
   */
  detectNPlusOneProblems(): NPlusOneDetection[] {
    if (!this.config.analyzeNPlusOne) {
      return [];
    }

    const logs = this.queryLogger.getQueryLogs();
    const detections: NPlusOneDetection[] = [];

    // Pattern 1: Multiple queries to same model in short time
    const modelQueries = this.groupByModel(logs);
    for (const [model, modelLogs] of modelQueries.entries()) {
      const rapidQueries = this.detectRapidQueries(modelLogs);
      if (rapidQueries.length > 5) {
        detections.push({
          detected: true,
          pattern: 'rapid_same_model_queries',
          affectedQueries: rapidQueries.map(q => q.query),
          suggestedSolution: `Consider using batch queries or include relations for model '${model}'`,
        });
      }
    }

    // Pattern 2: Find queries that could be batched
    const findManyQueries = logs.filter(log => log.action === 'findMany');
    const groupedByParams = this.groupBySimilarParams(findManyQueries);
    
    for (const [paramKey, paramQueries] of groupedByParams.entries()) {
      if (paramQueries.length > 3) {
        detections.push({
          detected: true,
          pattern: 'batchable_queries',
          affectedQueries: paramQueries.map(q => q.query),
          suggestedSolution: 'Consider batching these queries into a single findMany with IN clause',
        });
      }
    }

    return detections;
  }

  /**
   * Suggest database indexes based on query patterns
   */
  suggestIndexes(): Array<{
    table: string;
    columns: string[];
    reason: string;
    impact: string;
  }> {
    if (!this.config.suggestIndexes) {
      return [];
    }

    const logs = this.queryLogger.getQueryLogs();
    const indexSuggestions: Array<{
      table: string;
      columns: string[];
      reason: string;
      impact: string;
    }> = [];

    // Analyze WHERE clauses
    const whereClauses = this.extractWhereClauses(logs);
    for (const [table, columns] of whereClauses.entries()) {
      if (columns.length > 0) {
        indexSuggestions.push({
          table,
          columns,
          reason: `Frequently queried columns in WHERE clause`,
          impact: 'medium',
        });
      }
    }

    // Analyze ORDER BY clauses
    const orderByClauses = this.extractOrderByClauses(logs);
    for (const [table, columns] of orderByClauses.entries()) {
      if (columns.length > 0) {
        indexSuggestions.push({
          table,
          columns,
          reason: `Frequently used columns in ORDER BY clause`,
          impact: 'low',
        });
      }
    }

    // Analyze JOIN conditions
    const joinConditions = this.extractJoinConditions(logs);
    for (const [table, columns] of joinConditions.entries()) {
      if (columns.length > 0) {
        indexSuggestions.push({
          table,
          columns,
          reason: `Foreign key used in JOIN operations`,
          impact: 'high',
        });
      }
    }

    // Deduplicate suggestions
    const uniqueSuggestions = this.deduplicateIndexSuggestions(indexSuggestions);
    return uniqueSuggestions;
  }

  /**
   * Optimize a Prisma query
   */
  optimizeQuery(
    query: any,
    model: string
  ): any {
    if (!this.config.autoOptimize) {
      return query;
    }

    let optimizedQuery = { ...query };

    // Add select if not present and not using include
    if (!query.select && !query.include) {
      // Only select common fields to reduce data transfer
      optimizedQuery = this.addCommonSelect(optimizedQuery, model);
    }

    // Add pagination if missing and could return many results
    if (!query.take && !query.cursor) {
      optimizedQuery = { ...optimizedQuery, take: 100 };
    }

    return optimizedQuery;
  }

  /**
   * Get cached result if available
   */
  getCachedResult<T>(cacheKey: string): T | null {
    if (!this.config.cacheResults) {
      return null;
    }

    const cached = this.queryCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTTL) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Cache a query result
   */
  cacheResult(cacheKey: string, data: any): void {
    if (!this.config.cacheResults) {
      return;
    }

    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
    };
  }

  /**
   * Generate optimization report
   */
  generateReport(): {
    summary: {
      totalQueries: number;
      slowQueries: number;
      failedQueries: number;
      averageDuration: number;
    };
    suggestions: OptimizationSuggestion[];
    nPlusOneProblems: NPlusOneDetection[];
    indexSuggestions: Array<{
      table: string;
      columns: string[];
      reason: string;
      impact: string;
    }>;
    cacheStats: {
      size: number;
      keys: string[];
    };
  } {
    const stats = this.queryLogger.getStatistics();
    const suggestions = this.getOptimizationSuggestions();
    const nPlusOneProblems = this.detectNPlusOneProblems();
    const indexSuggestions = this.suggestIndexes();
    const cacheStats = this.getCacheStats();

    return {
      summary: {
        totalQueries: stats.totalQueries,
        slowQueries: stats.slowQueries,
        failedQueries: stats.failedQueries,
        averageDuration: stats.averageDuration,
      },
      suggestions,
      nPlusOneProblems,
      indexSuggestions,
      cacheStats,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueryOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Group queries by their signature
   */
  private groupQueries(logs: QueryLogEntry[]): Map<string, QueryLogEntry[]> {
    const groups = new Map<string, QueryLogEntry[]>();

    for (const log of logs) {
      const key = `${log.model}.${log.action}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(log);
    }

    return groups;
  }

  /**
   * Analyze a group of similar queries
   */
  private analyzeQueryGroup(queryKey: string, logs: QueryLogEntry[]): QueryAnalysis {
    const durations = logs.map(log => log.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const suggestions = this.generateSuggestions(queryKey, logs, averageDuration);
    const nPlusOneIssues = this.analyzeNPlusOneForQuery(queryKey, logs);

    return {
      query: queryKey,
      executionCount: logs.length,
      averageDuration,
      totalDuration,
      suggestions,
      nPlusOneIssues,
    };
  }

  /**
   * Generate optimization suggestions for a query
   */
  private generateSuggestions(
    queryKey: string,
    logs: QueryLogEntry[],
    averageDuration: number
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Slow query suggestion
    if (averageDuration > 1000) {
      suggestions.push({
        type: 'query',
        severity: averageDuration > 5000 ? 'critical' : 'high',
        message: `Query '${queryKey}' is slow (${averageDuration.toFixed(0)}ms average)`,
        recommendation: 'Consider adding indexes, optimizing the query, or using caching',
        impact: 'High impact on performance',
      });
    }

    // Frequent query suggestion
    if (logs.length > 100) {
      suggestions.push({
        type: 'cache',
        severity: 'medium',
        message: `Query '${queryKey}' is executed frequently (${logs.length} times)`,
        recommendation: 'Consider implementing caching for this query',
        impact: 'Reduces database load',
      });
    }

    // Failed query suggestion
    const failedLogs = logs.filter(log => !log.success);
    if (failedLogs.length > 0) {
      suggestions.push({
        type: 'general',
        severity: 'high',
        message: `Query '${queryKey}' has ${failedLogs.length} failed executions`,
        recommendation: 'Review error logs and fix the underlying issue',
        impact: 'Critical for reliability',
      });
    }

    return suggestions;
  }

  /**
   * Analyze N+1 problems for a specific query
   */
  private analyzeNPlusOneForQuery(
    queryKey: string,
    logs: QueryLogEntry[]
  ): NPlusOneDetection[] {
    const detections: NPlusOneDetection[] = [];

    // Check if this is a findMany query with many executions
    if (queryKey.includes('findMany') && logs.length > 10) {
      const timeSpan = this.getTimeSpan(logs);
      if (timeSpan < 1000) {
        // Many findMany queries in short time
        detections.push({
          detected: true,
          pattern: 'rapid_findMany',
          affectedQueries: logs.map(l => l.query),
          suggestedSolution: 'Consider using a single query with include or batch loading',
        });
      }
    }

    return detections;
  }

  /**
   * Group logs by model
   */
  private groupByModel(logs: QueryLogEntry[]): Map<string, QueryLogEntry[]> {
    const groups = new Map<string, QueryLogEntry[]>();

    for (const log of logs) {
      if (!groups.has(log.model)) {
        groups.set(log.model, []);
      }
      groups.get(log.model)!.push(log);
    }

    return groups;
  }

  /**
   * Detect rapid queries to the same model
   */
  private detectRapidQueries(logs: QueryLogEntry[]): QueryLogEntry[] {
    const rapidQueries: QueryLogEntry[] = [];
    const timeWindow = 1000; // 1 second

    for (let i = 0; i < logs.length; i++) {
      const currentLog = logs[i];
      const nearbyLogs = logs.filter((log, idx) => {
        return idx !== i && Math.abs(log.timestamp.getTime() - currentLog.timestamp.getTime()) < timeWindow;
      });

      if (nearbyLogs.length > 2) {
        rapidQueries.push(currentLog);
      }
    }

    return rapidQueries;
  }

  /**
   * Group queries by similar parameters
   */
  private groupBySimilarParams(logs: QueryLogEntry[]): Map<string, QueryLogEntry[]> {
    const groups = new Map<string, QueryLogEntry[]>();

    for (const log of logs) {
      const paramKey = JSON.stringify(log.params || {});
      if (!groups.has(paramKey)) {
        groups.set(paramKey, []);
      }
      groups.get(paramKey)!.push(log);
    }

    return groups;
  }

  /**
   * Extract WHERE clauses from query logs
   */
  private extractWhereClauses(logs: QueryLogEntry[]): Map<string, string[]> {
    const whereClauses = new Map<string, string[]>();

    for (const log of logs) {
      if (log.params && log.params.where) {
        const columns = Object.keys(log.params.where);
        if (!whereClauses.has(log.model)) {
          whereClauses.set(log.model, []);
        }
        whereClauses.get(log.model)!.push(...columns);
      }
    }

    return whereClauses;
  }

  /**
   * Extract ORDER BY clauses from query logs
   */
  private extractOrderByClauses(logs: QueryLogEntry[]): Map<string, string[]> {
    const orderByClauses = new Map<string, string[]>();

    for (const log of logs) {
      if (log.params && log.params.orderBy) {
        const columns = Object.keys(log.params.orderBy);
        if (!orderByClauses.has(log.model)) {
          orderByClauses.set(log.model, []);
        }
        orderByClauses.get(log.model)!.push(...columns);
      }
    }

    return orderByClauses;
  }

  /**
   * Extract JOIN conditions from query logs
   */
  private extractJoinConditions(logs: QueryLogEntry[]): Map<string, string[]> {
    const joinConditions = new Map<string, string[]>();

    for (const log of logs) {
      if (log.params && log.params.include) {
        const relations = Object.keys(log.params.include);
        if (!joinConditions.has(log.model)) {
          joinConditions.set(log.model, []);
        }
        joinConditions.get(log.model)!.push(...relations);
      }
    }

    return joinConditions;
  }

  /**
   * Deduplicate index suggestions
   */
  private deduplicateIndexSuggestions(
    suggestions: Array<{
      table: string;
      columns: string[];
      reason: string;
      impact: string;
    }>
  ): Array<{
    table: string;
    columns: string[];
    reason: string;
    impact: string;
  }> {
    const unique = new Map<string, typeof suggestions[0]>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.table}:${suggestion.columns.join(',')}`;
      if (!unique.has(key)) {
        unique.set(key, suggestion);
      }
    }

    return Array.from(unique.values());
  }

  /**
   * Add common select fields to a query
   */
  private addCommonSelect(
    query: any,
    model: string
  ): any {
    const commonFields: Record<string, string[]> = {
      User: ['id', 'email', 'role', 'createdAt'],
      ApiKey: ['id', 'name', 'tier', 'isActive', 'createdAt'],
      ApiUsage: ['id', 'endpoint', 'method', 'statusCode', 'timestamp'],
    };

    const fields = commonFields[model] || ['id'];
    const select: Record<string, boolean> = {};
    fields.forEach(field => {
      select[field] = true;
    });

    return {
      ...query,
      select,
    } as any;
  }

  /**
   * Get time span of query logs
   */
  private getTimeSpan(logs: QueryLogEntry[]): number {
    if (logs.length === 0) return 0;

    const timestamps = logs.map(log => log.timestamp.getTime());
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);

    return max - min;
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.queryCache.delete(key));
  }
}

/**
 * Create a query optimizer with default configuration
 */
export function createQueryOptimizer(
  queryLogger: QueryLogger,
  config?: Partial<QueryOptimizerConfig>
): QueryOptimizer {
  return new QueryOptimizer(queryLogger, config);
}
