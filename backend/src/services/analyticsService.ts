import { PrismaClient } from '@prisma/client';
import { DataSource } from 'typeorm';
import { log } from '../utils/logger';
import { CreditScore } from '../models/CreditScore';
import { FraudAlert } from '../models/FraudAlert';
import { Transaction } from '../models/Transaction';

export interface DashboardSummary {
  systemUsage: {
    totalRequests: number;
    avgLatency: number;
    errorRate: number;
    successRate: number;
  };
  aiPerformance: {
    avgCreditScore: number;
    totalFraudAlerts: number;
    resolvedAlerts: number;
    riskDistribution: Record<string, number>;
  };
  blockchainActivity: {
    totalTxCount: number;
    totalVolume: number;
    assetDistribution: Record<string, number>;
  };
}

export interface TrendPoint {
  date: string;
  value: number;
}

interface RawTrendResult {
  date: string;
  count: bigint | number;
}

interface RawAlertResult {
  resolved: string | boolean;
  count: string;
}

interface RawRiskResult {
  tier: string;
  count: string;
}

interface RawTxStatsResult {
  count: string;
  volume: string;
}

interface RawAssetResult {
  asset: string;
  count: string;
}

interface RawScoreResult {
  avg: string | null;
}

export class AnalyticsService {
  constructor(
    private prisma: PrismaClient,
    private typeorm: DataSource
  ) {}

  /**
   * Get comprehensive dashboard summary
   */
  async getDashboardSummary(startDate: Date, endDate: Date): Promise<DashboardSummary> {
    try {
      const [usageStats, aiStats, blockchainStats] = await Promise.all([
        this.getSystemUsageStats(startDate, endDate),
        this.getAIPerformanceStats(startDate, endDate),
        this.getBlockchainStats(startDate, endDate),
      ]);

      return {
        systemUsage: usageStats,
        aiPerformance: aiStats,
        blockchainActivity: blockchainStats,
      };
    } catch (error) {
      log.error('Failed to get dashboard summary', error as Error);
      throw new Error('Analytics aggregation failed');
    }
  }

  private async getSystemUsageStats(
    startDate: Date,
    endDate: Date
  ): Promise<DashboardSummary['systemUsage']> {
    const usage = await this.prisma.apiUsage.aggregate({
      where: { timestamp: { gte: startDate, lte: endDate } },
      _count: true,
      _avg: { responseTime: true },
    });

    const errorCount = await this.prisma.apiUsage.count({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        statusCode: { gte: 400 },
      },
    });

    const total: number = (usage._count as number) || 0;
    return {
      totalRequests: total,
      avgLatency: usage._avg.responseTime || 0,
      errorRate: total > 0 ? (errorCount / total) * 100 : 0,
      successRate: total > 0 ? ((total - errorCount) / total) * 100 : 0,
    };
  }

  private async getAIPerformanceStats(
    _startDate: Date,
    _endDate: Date
  ): Promise<DashboardSummary['aiPerformance']> {
    try {
      const scores = await this.typeorm
        .getRepository(CreditScore)
        .createQueryBuilder('score')
        .where('score.createdAt BETWEEN :start AND :end', { start: _startDate, end: _endDate })
        .select('AVG(score.score)', 'avg')
        .getRawOne<RawScoreResult>();

      const alerts = await this.typeorm
        .getRepository(FraudAlert)
        .createQueryBuilder('alert')
        .where('alert.createdAt BETWEEN :start AND :end', { start: _startDate, end: _endDate })
        .select('alert.resolved', 'resolved')
        .addSelect('COUNT(*)', 'count')
        .groupBy('alert.resolved')
        .getRawMany<RawAlertResult>();

      const riskDist = await this.typeorm
        .getRepository(CreditScore)
        .createQueryBuilder('score')
        .select(
          "CASE WHEN score.score >= 800 THEN 'Excellent' WHEN score.score >= 700 THEN 'Good' WHEN score.score >= 600 THEN 'Fair' ELSE 'Poor' END",
          'tier'
        )
        .addSelect('COUNT(*)', 'count')
        .groupBy('tier')
        .getRawMany<RawRiskResult>();

      return {
        avgCreditScore: parseFloat(scores?.avg ?? '0') || 0,
        totalFraudAlerts: alerts.reduce((acc: number, a: RawAlertResult) => acc + parseInt(a.count, 10), 0),
        resolvedAlerts:
          parseInt(
            alerts.find((a: RawAlertResult) => Boolean(a.resolved))?.count ?? '0',
            10
          ) || 0,
        riskDistribution: riskDist.reduce<Record<string, number>>(
          (acc: Record<string, number>, d: RawRiskResult) => {
            acc[d.tier] = parseInt(d.count, 10);
            return acc;
          },
          {}
        ),
      };
    } catch (error) {
      log.warn('AI performance stats query failed (empty DB?)', error as Error);
      return {
        avgCreditScore: 0,
        totalFraudAlerts: 0,
        resolvedAlerts: 0,
        riskDistribution: {},
      };
    }
  }

  private async getBlockchainStats(
    _startDate: Date,
    _endDate: Date
  ): Promise<DashboardSummary['blockchainActivity']> {
    try {
      const txStats = await this.typeorm
        .getRepository(Transaction)
        .createQueryBuilder('tx')
        .where('tx.timestamp BETWEEN :start AND :end', { start: _startDate, end: _endDate })
        .select('COUNT(*)', 'count')
        .addSelect('SUM(tx.amount)', 'volume')
        .getRawOne<RawTxStatsResult>();

      const assetDist = await this.typeorm
        .getRepository(Transaction)
        .createQueryBuilder('tx')
        .select('tx.assetType', 'asset')
        .addSelect('COUNT(*)', 'count')
        .groupBy('tx.assetType')
        .getRawMany<RawAssetResult>();

      return {
        totalTxCount: parseInt(txStats?.count ?? '0', 10) || 0,
        totalVolume: parseFloat(txStats?.volume ?? '0') || 0,
        assetDistribution: assetDist.reduce<Record<string, number>>(
          (acc: Record<string, number>, d: RawAssetResult) => {
            acc[d.asset] = parseInt(d.count, 10);
            return acc;
          },
          {}
        ),
      };
    } catch (error) {
      log.warn('Blockchain stats query failed (empty DB?)', error as Error);
      return {
        totalTxCount: 0,
        totalVolume: 0,
        assetDistribution: {},
      };
    }
  }

  /**
   * Get traffic trends for forecasting
   */
  async getTrafficTrends(days: number = 30): Promise<TrendPoint[]> {
    const results = await this.prisma.$queryRaw<RawTrendResult>`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM api_usage
      WHERE timestamp >= date('now', ${`-${days} days`})
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    return results.map((r: RawTrendResult) => ({
      date: r.date,
      value: Number(r.count),
    }));
  }

  /**
   * Simple linear forecasting for next 7 days
   */
  async getForecast(days: number = 7): Promise<TrendPoint[]> {
    const history = await this.getTrafficTrends(30);
    if (history.length < 2) return [];

    // Simple linear regression (y = mx + b)
    const n = history.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    history.forEach((point, i) => {
      sumX += i;
      sumY += point.value;
      sumXY += i * point.value;
      sumXX += i * i;
    });

    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    const lastDate = new Date(history[history.length - 1].date);
    const forecast: TrendPoint[] = [];

    for (let i = 1; i <= days; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + i);
      forecast.push({
        date: nextDate.toISOString().split('T')[0],
        value: Math.max(0, m * (n + i - 1) + b),
      });
    }

    return forecast;
  }
}
