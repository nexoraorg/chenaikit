/**
 * Query Optimizer Service
 * 
 * This service provides intelligent query optimization suggestions,
 * automatic query rewriting, and performance analysis.
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../utils/logger';
import { queryMonitor, QueryMetrics } from '../utils/queryUtils';

export interface OptimizationSuggestion {
  type: 'index' | 'n_plus_1' | 'select' | 'batch' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  location?: string;
  estimatedImpact?: string;
}

export interface QueryAnalysis {
  query: string;
  duration: number;
  rowCount?: number;
  suggestions: OptimizationSuggestion[];
  optimized?: boolean;
}

export class QueryOptimizer {
  private prisma: PrismaClient;
  private analysisHistory: QueryAnalysis[] = [];
  private maxHistory = 100;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Analyze a query and provide optimization suggestions
   */
  analyzeQuery(query: string, duration: number, rowCount?: number): QueryAnalysis {
    const suggestions = this.generateSuggestions(query, duration, rowCount);
    
    const analysis: QueryAnalysis = {
      query,
      duration,
      rowCount,
      suggestions,
      optimized: suggestions.length === 0
    };

    this.addToHistory(analysis);
    
    return analysis;
  }

  /**
   * Analyze recent queries from the monitor
   */
  analyzeRecentQueries(limit: number = 50): QueryAnalysis[] {
    const metrics = queryMonitor.getMetrics().slice(-limit);
    return metrics.map(metric => 
      this.analyzeQuery(metric.query, metric.duration, metric.rowCount)
    );
  }

  /**
   * Generate optimization suggestions based on query patterns
   */
  private generateSuggestions(
    query: string,
    duration: number,
    rowCount?: number
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for slow queries
    if (duration > 1000) {
      suggestions.push({
        type: 'cache',
        severity: 'high',
        description: 'Query is slow (>1s)',
        suggestion: 'Consider caching this query result or adding database indexes',
        estimatedImpact: 'High - could reduce response time by 80-90%'
      });
    }

    // Check for N+1 query patterns
    if (this.detectNPlusOnePattern(query)) {
      suggestions.push({
        type: 'n_plus_1',
        severity: 'critical',
        description: 'Potential N+1 query pattern detected',
        suggestion: 'Use Prisma include/select or implement DataLoader to batch queries',
        estimatedImpact: 'Critical - could reduce database round trips by 90%+'
      });
    }

    // Check for missing select optimization
    if (this.detectMissingSelect(query)) {
      suggestions.push({
        type: 'select',
        severity: 'medium',
        description: 'Query may be selecting unnecessary fields',
        suggestion: 'Use Prisma select to only fetch required fields',
        estimatedImpact: 'Medium - could reduce data transfer by 30-50%'
      });
    }

    // Check for batch operation opportunities
    if (this.detectBatchOpportunity(query)) {
      suggestions.push({
        type: 'batch',
        severity: 'medium',
        description: 'Multiple similar queries detected',
        suggestion: 'Use Prisma createMany/updateMany or batch operations',
        estimatedImpact: 'Medium - could reduce query count by 70-80%'
      });
    }

    // Check for index opportunities
    if (this.detectIndexOpportunity(query)) {
      suggestions.push({
        type: 'index',
        severity: 'high',
        description: 'Query could benefit from database index',
        suggestion: 'Add composite index on frequently queried columns',
        estimatedImpact: 'High - could improve query performance by 50-90%'
      });
    }

    return suggestions;
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOnePattern(query: string): boolean {
    // Look for patterns like repeated findMany with similar conditions
    const patterns = [
      /findMany.*where.*userId/g,
      /findFirst.*where.*userId/g,
      /findUnique.*where.*id/g
    ];

    return patterns.some(pattern => {
      const matches = query.match(pattern);
      return matches && matches.length > 1;
    });
  }

  /**
   * Detect missing select optimization
   */
  private detectMissingSelect(query: string): boolean {
    // If query doesn't have select and is fetching many records
    return query.includes('findMany') && !query.includes('select');
  }

  /**
   * Detect batch operation opportunities
   */
  private detectBatchOpportunity(query: string): boolean {
    // Look for patterns that could be batched
    return query.includes('create') || query.includes('update');
  }

  /**
   * Detect index opportunities
   */
  private detectIndexOpportunity(query: string): boolean {
    // Look for where clauses on non-indexed columns
    const commonFields = ['userId', 'email', 'timestamp', 'status', 'tier'];
    return commonFields.some(field => 
      query.includes(`where.*${field}`) && !query.includes('index')
    );
  }

  /**
   * Add analysis to history
   */
  private addToHistory(analysis: QueryAnalysis): void {
    this.analysisHistory.push(analysis);
    
    if (this.analysisHistory.length > this.maxHistory) {
      this.analysisHistory.shift();
    }
  }

  /**
   * Get optimization suggestions for the entire application
   */
  getGlobalOptimizations(): OptimizationSuggestion[] {
    const allSuggestions = this.analysisHistory.flatMap(a => a.suggestions);
    
    // Deduplicate suggestions
    const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);
    
    // Sort by severity
    return uniqueSuggestions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Deduplicate suggestions
   */
  private deduplicateSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(s => {
      const key = `${s.type}-${s.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const analyses = this.analysisHistory;
    const totalQueries = analyses.length;
    const optimizedQueries = analyses.filter(a => a.optimized).length;
    const avgDuration = analyses.reduce((sum, a) => sum + a.duration, 0) / totalQueries;
    
    const suggestionsByType = this.groupSuggestionsByType();
    const suggestionsBySeverity = this.groupSuggestionsBySeverity();

    return {
      totalQueries,
      optimizedQueries,
      optimizationRate: totalQueries > 0 ? (optimizedQueries / totalQueries) * 100 : 0,
      avgDuration,
      suggestionsByType,
      suggestionsBySeverity
    };
  }

  /**
   * Group suggestions by type
   */
  private groupSuggestionsByType(): Record<string, number> {
    const allSuggestions = this.analysisHistory.flatMap(a => a.suggestions);
    const grouped: Record<string, number> = {};
    
    for (const suggestion of allSuggestions) {
      grouped[suggestion.type] = (grouped[suggestion.type] || 0) + 1;
    }
    
    return grouped;
  }

  /**
   * Group suggestions by severity
   */
  private groupSuggestionsBySeverity(): Record<string, number> {
    const allSuggestions = this.analysisHistory.flatMap(a => a.suggestions);
    const grouped: Record<string, number> = {};
    
    for (const suggestion of allSuggestions) {
      grouped[suggestion.severity] = (grouped[suggestion.severity] || 0) + 1;
    }
    
    return grouped;
  }

  /**
   * Optimize a Prisma query by rewriting it
   */
  optimizeQuery<T>(
    originalQuery: () => Promise<T>,
    options: {
      addSelect?: string[];
      addInclude?: string[];
      useCache?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
    } = {}
  ): Promise<T> {
    const { addSelect, addInclude, useCache, cacheKey, cacheTTL } = options;
    
    // This is a placeholder for actual query optimization
    // In a real implementation, this would use AST parsing to rewrite queries
    log.info('Optimizing query', { options });
    
    return originalQuery();
  }

  /**
   * Generate optimization report
   */
  generateReport(): string {
    const stats = this.getPerformanceStats();
    const globalSuggestions = this.getGlobalOptimizations();
    
    let report = '=== Query Optimization Report ===\n\n';
    report += `Total Queries Analyzed: ${stats.totalQueries}\n`;
    report += `Optimized Queries: ${stats.optimizedQueries}\n`;
    report += `Optimization Rate: ${stats.optimizationRate.toFixed(2)}%\n`;
    report += `Average Query Duration: ${stats.avgDuration.toFixed(2)}ms\n\n`;
    
    report += '=== Suggestions by Type ===\n';
    for (const [type, count] of Object.entries(stats.suggestionsByType)) {
      report += `${type}: ${count}\n`;
    }
    
    report += '\n=== Suggestions by Severity ===\n';
    for (const [severity, count] of Object.entries(stats.suggestionsBySeverity)) {
      report += `${severity}: ${count}\n`;
    }
    
    report += '\n=== Top Optimization Suggestions ===\n';
    for (const suggestion of globalSuggestions.slice(0, 10)) {
      report += `\n[${suggestion.severity.toUpperCase()}] ${suggestion.description}\n`;
      report += `Suggestion: ${suggestion.suggestion}\n`;
      if (suggestion.estimatedImpact) {
        report += `Estimated Impact: ${suggestion.estimatedImpact}\n`;
      }
    }
    
    return report;
  }

  /**
   * Clear analysis history
   */
  clearHistory(): void {
    this.analysisHistory = [];
  }
}

/**
 * Create a query optimizer instance
 */
export function createQueryOptimizer(prisma: PrismaClient): QueryOptimizer {
  return new QueryOptimizer(prisma);
}
