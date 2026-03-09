import { PrismaClient } from '../generated/prisma';
import { ApiUsage } from '../models/ApiKey';
import { Request } from 'express';
import { log } from '../utils/logger';

export interface UsageRecord {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  ip: string;
  userAgent?: string;
}

export interface UsageAnalytics {
  totalRequests: number;
  uniqueApiKeys: number;
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  hourlyStats: Array<{
    hour: string;
    requests: number;
  }>;
  statusDistribution: Record<string, number>;
  tierDistribution: Record<string, number>;
}

export class UsageTrackingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record API usage
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      await this.prisma.apiUsage.create({
        data: {
          apiKeyId: record.apiKeyId,
          endpoint: record.endpoint,
          method: record.method,
          statusCode: record.statusCode,
          responseTime: record.responseTime,
          requestSize: record.requestSize,
          responseSize: record.responseSize,
          ip: record.ip,
          userAgent: record.userAgent,
        },
      });

      log.debug('Usage recorded', {
        apiKeyId: record.apiKeyId,
        endpoint: record.endpoint,
        statusCode: record.statusCode,
        responseTime: record.responseTime,
      });
    } catch (error: any) {
      log.error('Failed to record usage', error as Error);
      // Don't throw here as usage tracking should not break API requests
    }
  }

  /**
   * Extract usage information from Express request
   */
  extractUsageFromRequest(req: Request, apiKeyId: string, responseTime: number, statusCode: number, responseSize: number): UsageRecord {
    return {
      apiKeyId,
      endpoint: req.path,
      method: req.method,
      statusCode,
      responseTime,
      requestSize: JSON.stringify(req.body).length || 0,
      responseSize,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
    };
  }

  /**
   * Get usage analytics for a specific time period
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<UsageAnalytics> {
    try {
      const whereClause = {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      };

      const [
        totalRequests,
        uniqueApiKeys,
        avgResponseTime,
        successCount,
        endpointStats,
        hourlyStats,
        statusDistribution,
      ] = await Promise.all([
        this.prisma.apiUsage.count({ where: whereClause }),
        this.prisma.apiUsage.findMany({
          where: whereClause,
          select: { apiKeyId: true },
          distinct: ['apiKeyId'],
        }).then(results => results.length),
        this.prisma.apiUsage.aggregate({
          where: whereClause,
          _avg: { responseTime: true },
        }),
        this.prisma.apiUsage.count({
          where: { ...whereClause, statusCode: { lt: 400 } },
        }),
        this.prisma.apiUsage.groupBy({
          by: ['endpoint'],
          where: whereClause,
          _count: true,
          _avg: { responseTime: true },
          orderBy: { _count: { endpoint: 'desc' } },
          take: 10,
        }),
        this.prisma.$queryRaw`
          SELECT 
            strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
            COUNT(*) as requests
          FROM api_usage 
          WHERE timestamp >= ${startDate}
            AND timestamp <= ${endDate}
            AND deletedAt IS NULL
          GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
          ORDER BY hour DESC
          LIMIT 24
        `,
        this.prisma.apiUsage.groupBy({
          by: ['statusCode'],
          where: whereClause,
          _count: true,
        }),
      ]);

      const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
      const errorRate = 100 - successRate;

      // Get tier distribution
      const tierDistribution = await this.getTierDistribution(whereClause);

      return {
        totalRequests,
        uniqueApiKeys,
        averageResponseTime: avgResponseTime._avg.responseTime || 0,
        successRate,
        errorRate,
        topEndpoints: endpointStats.map(item => ({
          endpoint: item.endpoint,
          count: item._count,
          avgResponseTime: item._avg.responseTime || 0,
        })),
        hourlyStats: (hourlyStats as any[]).map(item => ({
          hour: item.hour,
          requests: Number(item.requests),
        })),
        statusDistribution: statusDistribution.reduce((acc, item) => {
          acc[item.statusCode.toString()] = item._count;
          return acc;
        }, {} as Record<string, number>),
        tierDistribution,
      };
    } catch (error: any) {
      log.error('Failed to get analytics', error as Error);
      throw new Error('Failed to get analytics');
    }
  }

  /**
   * Get tier distribution for usage
   */
  private async getTierDistribution(whereClause: any): Promise<Record<string, number>> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 
          ak.tier,
          COUNT(*) as count
        FROM api_usage au
        JOIN api_keys ak ON au.api_key_id = ak.id
        WHERE au.timestamp >= ${whereClause.timestamp.gte}
          AND au.timestamp <= ${whereClause.timestamp.lte}
          AND au.deletedAt IS NULL
          AND ak.deletedAt IS NULL
        GROUP BY ak.tier
      `;

      return (result as any[]).reduce((acc, item) => {
        acc[item.tier] = Number(item.count);
        return acc;
      }, {} as Record<string, number>);
    } catch (error: any) {
      log.error('Failed to get tier distribution', error as Error);
      return {};
    }
  }

  /**
   * Get usage for a specific API key
   */
  async getApiKeyUsage(apiKeyId: string, startDate?: Date, endDate?: Date): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    endpointBreakdown: Array<{
      endpoint: string;
      count: number;
      avgResponseTime: number;
    }>;
    dailyUsage: Array<{
      date: string;
      requests: number;
    }>;
  }> {
    try {
      const whereClause: any = { apiKeyId, deletedAt: null };
      
      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) whereClause.timestamp.gte = startDate;
        if (endDate) whereClause.timestamp.lte = endDate;
      }

      const [totalRequests, avgResponseTime, successCount, endpointBreakdown, dailyUsage] = await Promise.all([
        this.prisma.apiUsage.count({ where: whereClause }),
        this.prisma.apiUsage.aggregate({
          where: whereClause,
          _avg: { responseTime: true },
        }),
        this.prisma.apiUsage.count({
          where: { ...whereClause, statusCode: { lt: 400 } },
        }),
        this.prisma.apiUsage.groupBy({
          by: ['endpoint'],
          where: whereClause,
          _count: true,
          _avg: { responseTime: true },
          orderBy: { _count: { endpoint: 'desc' } },
        }),
        this.prisma.$queryRaw`
          SELECT 
            DATE(timestamp) as date,
            COUNT(*) as requests
          FROM api_usage 
          WHERE api_key_id = ${apiKeyId}
            AND timestamp >= datetime('now', '-30 days')
            AND deletedAt IS NULL
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `,
      ]);

      const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

      return {
        totalRequests,
        averageResponseTime: avgResponseTime._avg.responseTime || 0,
        successRate,
        endpointBreakdown: endpointBreakdown.map(item => ({
          endpoint: item.endpoint,
          count: item._count,
          avgResponseTime: item._avg.responseTime || 0,
        })),
        dailyUsage: (dailyUsage as any[]).map(item => ({
          date: item.date,
          requests: Number(item.requests),
        })),
      };
    } catch (error: any) {
      log.error('Failed to get API key usage', error as Error);
      throw new Error('Failed to get API key usage');
    }
  }

  /**
   * Get real-time usage metrics
   */
  async getRealTimeMetrics(): Promise<{
    requestsLastMinute: number;
    requestsLastHour: number;
    activeApiKeys: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [
        requestsLastMinute,
        requestsLastHour,
        activeApiKeys,
        recentMetrics,
      ] = await Promise.all([
        this.prisma.apiUsage.count({
          where: {
            timestamp: { gte: oneMinuteAgo },
            deletedAt: null,
          },
        }),
        this.prisma.apiUsage.count({
          where: {
            timestamp: { gte: oneHourAgo },
            deletedAt: null,
          },
        }),
        this.prisma.apiUsage.findMany({
          where: {
            timestamp: { gte: oneMinuteAgo },
            deletedAt: null,
          },
          select: { apiKeyId: true },
          distinct: ['apiKeyId'],
        }).then(results => results.length),
        this.prisma.apiUsage.aggregate({
          where: {
            timestamp: { gte: oneMinuteAgo },
            deletedAt: null,
          },
          _avg: { responseTime: true },
          _count: true,
        }),
      ]);

      const errorCount = await this.prisma.apiUsage.count({
        where: {
          timestamp: { gte: oneMinuteAgo },
          statusCode: { gte: 400 },
          deletedAt: null,
        },
      });

      const errorRate = recentMetrics._count > 0 ? (errorCount / recentMetrics._count) * 100 : 0;

      return {
        requestsLastMinute,
        requestsLastHour,
        activeApiKeys,
        averageResponseTime: recentMetrics._avg.responseTime || 0,
        errorRate,
      };
    } catch (error: any) {
      log.error('Failed to get real-time metrics', error as Error);
      throw new Error('Failed to get real-time metrics');
    }
  }

  /**
   * Clean up old usage records (retention policy)
   */
  async cleanupOldUsage(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.apiUsage.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      log.info('Cleaned up old usage records', {
        count: result.count,
        cutoffDate,
      });

      return result.count;
    } catch (error: any) {
      log.error('Failed to cleanup old usage records', error as Error);
      throw new Error('Failed to cleanup old usage records');
    }
  }

  /**
   * Export usage data for billing purposes
   */
  async exportUsageData(startDate: Date, endDate: Date): Promise<Array<{
    apiKeyId: string;
    apiKeyName: string;
    tier: string;
    totalRequests: number;
    billableRequests: number;
    periodStart: Date;
    periodEnd: Date;
  }>> {
    try {
      const usageData = await this.prisma.$queryRaw`
        SELECT 
          au.api_key_id as apiKeyId,
          ak.name as apiKeyName,
          ak.tier,
          COUNT(*) as totalRequests,
          COUNT(*) as billableRequests,
          MIN(au.timestamp) as periodStart,
          MAX(au.timestamp) as periodEnd
        FROM api_usage au
        JOIN api_keys ak ON au.api_key_id = ak.id
        WHERE au.timestamp >= ${startDate}
          AND au.timestamp <= ${endDate}
          AND ak.is_active = true
          AND au.deletedAt IS NULL
          AND ak.deletedAt IS NULL
        GROUP BY au.api_key_id, ak.name, ak.tier
        ORDER BY totalRequests DESC
      `;

      return (usageData as any[]).map(item => ({
        apiKeyId: item.apiKeyId,
        apiKeyName: item.apiKeyName,
        tier: item.tier,
        totalRequests: Number(item.totalRequests),
        billableRequests: Number(item.billableRequests),
        periodStart: new Date(item.periodStart),
        periodEnd: new Date(item.periodEnd),
      }));
    } catch (error: any) {
      log.error('Failed to export usage data', error as Error);
      throw new Error('Failed to export usage data');
    }
  }
}
