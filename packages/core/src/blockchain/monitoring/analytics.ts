import { EventEmitter } from 'eventemitter3';
import NodeCache from 'node-cache';
import _ from 'lodash';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  LedgerEvent,
  TransactionAnalysis,
  TransactionMetrics,
  AssetMetric,
  AccountActivity,
  NetworkMetrics,
  ChartDataPoint
} from './types';

/**
 * Transaction analytics and metrics calculation engine
 */
export class TransactionAnalytics extends EventEmitter {
  private config: MonitoringConfig;
  private metricsCache: NodeCache;
  private transactionBuffer: TransactionEvent[] = [];
  private accountActivityMap: Map<string, AccountActivity> = new Map();
  private assetVolumeMap: Map<string, AssetMetric> = new Map();
  private realtimeMetrics: TransactionMetrics;
  private networkMetrics: NetworkMetrics;
  private chartDataPoints: {
    volume: ChartDataPoint[];
    count: ChartDataPoint[];
    alerts: ChartDataPoint[];
  };

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    
    // Cache for metrics (retain for 24 hours)
    this.metricsCache = new NodeCache({ 
      stdTTL: 86400,
      checkperiod: 3600
    });

    // Initialize metrics
    this.realtimeMetrics = this.createEmptyMetrics();
    this.networkMetrics = this.createEmptyNetworkMetrics();
    this.chartDataPoints = {
      volume: [],
      count: [],
      alerts: []
    };

    // Start periodic metrics calculation
    this.startPeriodicCalculation();
  }

  /**
   * Start the analytics engine
   */
  public async start(): Promise<void> {
    console.log('Transaction analytics started');
  }

  /**
   * Stop the analytics engine
   */
  public async stop(): Promise<void> {
    this.metricsCache.flushAll();
    console.log('Transaction analytics stopped');
  }

  /**
   * Process a new transaction
   */
  public processTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    try {
      // Add to buffer for batch processing
      this.transactionBuffer.push(transaction);
      
      // Update real-time metrics
      this.updateRealtimeMetrics(transaction, analysis);
      
      // Update account activity
      this.updateAccountActivity(transaction, analysis);
      
      // Update asset metrics
      this.updateAssetMetrics(transaction);
      
      // Process buffer in batches
      if (this.transactionBuffer.length >= (this.config.batchSize || 100)) {
        this.processBatch();
      }

    } catch (error) {
      console.error('Error processing transaction for analytics:', error);
    }
  }

  /**
   * Process a new ledger
   */
  public processLedger(ledger: LedgerEvent): void {
    try {
      this.updateNetworkMetrics(ledger);
      this.addChartDataPoint('count', ledger.transactionCount);
    } catch (error) {
      console.error('Error processing ledger for analytics:', error);
    }
  }

  /**
   * Get metrics for a specific time range
   */
  public async getMetrics(startTime: Date, endTime: Date): Promise<TransactionMetrics> {
    const cacheKey = `metrics_${startTime.getTime()}_${endTime.getTime()}`;
    
    // Check cache first
    const cachedMetrics = this.metricsCache.get(cacheKey) as TransactionMetrics;
    if (cachedMetrics) {
      return cachedMetrics;
    }

    // Calculate metrics for the time range
    const metrics = await this.calculateMetricsForTimeRange(startTime, endTime);
    
    // Cache the results
    this.metricsCache.set(cacheKey, metrics);
    
    return metrics;
  }

  /**
   * Get real-time metrics (current period)
   */
  public getRealtimeMetrics(): TransactionMetrics {
    return { ...this.realtimeMetrics };
  }

  /**
   * Get network metrics
   */
  public getNetworkMetrics(): NetworkMetrics {
    return { ...this.networkMetrics };
  }

  /**
   * Get account activity data
   */
  public getAccountActivity(limit: number = 100): AccountActivity[] {
    const activities = Array.from(this.accountActivityMap.values());
    
    // Sort by transaction count (most active first)
    activities.sort((a, b) => b.transactionCount - a.transactionCount);
    
    return activities.slice(0, limit);
  }

  /**
   * Get top assets by volume
   */
  public getTopAssets(limit: number = 10): AssetMetric[] {
    const assets = Array.from(this.assetVolumeMap.values());
    
    // Sort by volume (highest first)
    assets.sort((a, b) => b.volume - a.volume);
    
    return assets.slice(0, limit);
  }

  /**
   * Get chart data for visualization
   */
  public getChartData(): {
    volume: ChartDataPoint[];
    count: ChartDataPoint[];
    alerts: ChartDataPoint[];
  } {
    return {
      volume: [...this.chartDataPoints.volume],
      count: [...this.chartDataPoints.count],
      alerts: [...this.chartDataPoints.alerts]
    };
  }

  /**
   * Calculate transaction throughput (TPS)
   */
  public calculateThroughput(periodMinutes: number = 1): number {
    const now = new Date();
    const periodStart = new Date(now.getTime() - (periodMinutes * 60 * 1000));
    
    const recentTransactions = this.transactionBuffer.filter(tx => 
      new Date(tx.createdAt) >= periodStart
    );
    
    return recentTransactions.length / (periodMinutes * 60);
  }

  /**
   * Get transaction volume trend
   */
  public getVolumeTrend(hours: number = 24): ChartDataPoint[] {
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    return this.chartDataPoints.volume.filter(point => 
      point.timestamp >= startTime
    );
  }

  /**
   * Calculate average transaction value
   */
  public calculateAverageTransactionValue(): number {
    if (this.realtimeMetrics.totalTransactions === 0) {
      return 0;
    }
    
    return this.realtimeMetrics.totalVolume / this.realtimeMetrics.totalTransactions;
  }

  /**
   * Generate analytics report
   */
  public generateReport(startTime: Date, endTime: Date): Promise<{
    summary: TransactionMetrics;
    topAccounts: AccountActivity[];
    topAssets: AssetMetric[];
    trends: {
      volume: ChartDataPoint[];
      count: ChartDataPoint[];
    };
    insights: string[];
  }> {
    return new Promise(async (resolve) => {
      try {
        const summary = await this.getMetrics(startTime, endTime);
        const topAccounts = this.getAccountActivity(10);
        const topAssets = this.getTopAssets(10);
        const trends = {
          volume: this.getVolumeTrend(24),
          count: this.chartDataPoints.count.filter(point => 
            point.timestamp >= startTime && point.timestamp <= endTime
          )
        };
        
        const insights = this.generateInsights(summary, topAccounts, topAssets);
        
        resolve({
          summary,
          topAccounts,
          topAssets,
          trends,
          insights
        });
        
      } catch (error) {
        console.error('Error generating analytics report:', error);
        resolve({
          summary: this.createEmptyMetrics(),
          topAccounts: [],
          topAssets: [],
          trends: { volume: [], count: [] },
          insights: ['Error generating report']
        });
      }
    });
  }

  /**
   * Update real-time metrics with new transaction
   */
  private updateRealtimeMetrics(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    this.realtimeMetrics.totalTransactions++;
    
    if (transaction.successful) {
      this.realtimeMetrics.successfulTransactions++;
    } else {
      this.realtimeMetrics.failedTransactions++;
    }

    // Estimate transaction volume from fee (rough approximation)
    const estimatedVolume = parseFloat(transaction.fee) * 1000;
    this.realtimeMetrics.totalVolume += estimatedVolume;
    
    // Update average
    this.realtimeMetrics.averageTransactionValue = 
      this.realtimeMetrics.totalVolume / this.realtimeMetrics.totalTransactions;

    // Calculate TPS
    this.realtimeMetrics.transactionsPerSecond = this.calculateThroughput();

    // Add to chart data
    this.addChartDataPoint('volume', estimatedVolume);
    this.addChartDataPoint('count', 1);
  }

  /**
   * Update account activity tracking
   */
  private updateAccountActivity(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    const accountId = transaction.sourceAccount;
    
    let activity = this.accountActivityMap.get(accountId);
    if (!activity) {
      activity = {
        accountId,
        transactionCount: 0,
        totalSent: 0,
        totalReceived: 0,
        firstSeen: new Date(transaction.createdAt),
        lastSeen: new Date(transaction.createdAt),
        riskScore: 0,
        flags: []
      };
      this.accountActivityMap.set(accountId, activity);
    }

    // Update activity
    activity.transactionCount++;
    activity.lastSeen = new Date(transaction.createdAt);
    activity.riskScore = Math.max(activity.riskScore, analysis.riskScore);
    
    // Merge flags
    analysis.flags.forEach(flag => {
      if (!activity.flags.includes(flag)) {
        activity.flags.push(flag);
      }
    });

    // Estimate sent amount
    const estimatedAmount = parseFloat(transaction.fee) * 1000;
    activity.totalSent += estimatedAmount;
  }

  /**
   * Update asset metrics
   */
  private updateAssetMetrics(transaction: TransactionEvent): void {
    // For now, track native XLM only
    // This would be expanded to track all assets from operations
    const assetKey = 'XLM';
    
    let assetMetric = this.assetVolumeMap.get(assetKey);
    if (!assetMetric) {
      assetMetric = {
        asset: { type: 'native' },
        volume: 0,
        transactionCount: 0,
        averageAmount: 0
      };
      this.assetVolumeMap.set(assetKey, assetMetric);
    }

    const estimatedAmount = parseFloat(transaction.fee) * 1000;
    assetMetric.volume += estimatedAmount;
    assetMetric.transactionCount++;
    assetMetric.averageAmount = assetMetric.volume / assetMetric.transactionCount;
  }

  /**
   * Update network metrics with ledger data
   */
  private updateNetworkMetrics(ledger: LedgerEvent): void {
    this.networkMetrics.ledgerNumber = ledger.sequence;
    this.networkMetrics.transactionThroughput = ledger.transactionCount;
    this.networkMetrics.averageFee = ledger.baseFee;
    this.networkMetrics.timestamp = new Date(ledger.closedAt);
    
    // Simple health assessment
    if (ledger.transactionCount > 1000) {
      this.networkMetrics.networkHealth = 'healthy';
    } else if (ledger.transactionCount > 100) {
      this.networkMetrics.networkHealth = 'degraded';
    } else {
      this.networkMetrics.networkHealth = 'critical';
    }
  }

  /**
   * Add data point to chart data
   */
  private addChartDataPoint(type: 'volume' | 'count' | 'alerts', value: number): void {
    const dataPoint: ChartDataPoint = {
      timestamp: new Date(),
      value
    };

    this.chartDataPoints[type].push(dataPoint);

    // Keep only last 1000 points
    if (this.chartDataPoints[type].length > 1000) {
      this.chartDataPoints[type].shift();
    }
  }

  /**
   * Process transaction buffer in batch
   */
  private processBatch(): void {
    const batchSize = this.config.batchSize || 100;
    const batch = this.transactionBuffer.splice(0, batchSize);
    
    // Calculate batch metrics
    const batchMetrics = this.calculateBatchMetrics(batch);
    
    // Emit metrics event
    this.emit('metrics', batchMetrics);
  }

  /**
   * Calculate metrics for a batch of transactions
   */
  private calculateBatchMetrics(transactions: TransactionEvent[]): TransactionMetrics {
    const startTime = new Date(Math.min(...transactions.map(tx => new Date(tx.createdAt).getTime())));
    const endTime = new Date(Math.max(...transactions.map(tx => new Date(tx.createdAt).getTime())));
    
    const metrics: TransactionMetrics = {
      totalTransactions: transactions.length,
      successfulTransactions: transactions.filter(tx => tx.successful).length,
      failedTransactions: transactions.filter(tx => !tx.successful).length,
      totalVolume: transactions.reduce((sum, tx) => sum + (parseFloat(tx.fee) * 1000), 0),
      averageTransactionValue: 0,
      transactionsPerSecond: 0,
      uniqueAccounts: new Set(transactions.map(tx => tx.sourceAccount)).size,
      topAssets: this.getTopAssets(5),
      timeRange: { start: startTime, end: endTime }
    };

    metrics.averageTransactionValue = metrics.totalVolume / metrics.totalTransactions;
    metrics.transactionsPerSecond = transactions.length / ((endTime.getTime() - startTime.getTime()) / 1000);

    return metrics;
  }

  /**
   * Calculate metrics for a specific time range
   */
  private async calculateMetricsForTimeRange(startTime: Date, endTime: Date): Promise<TransactionMetrics> {
    // This would typically query a database
    // For now, return current metrics filtered by time
    const filteredTransactions = this.transactionBuffer.filter(tx => {
      const txTime = new Date(tx.createdAt);
      return txTime >= startTime && txTime <= endTime;
    });

    return this.calculateBatchMetrics(filteredTransactions);
  }

  /**
   * Create empty metrics structure
   */
  private createEmptyMetrics(): TransactionMetrics {
    return {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalVolume: 0,
      averageTransactionValue: 0,
      transactionsPerSecond: 0,
      uniqueAccounts: 0,
      topAssets: [],
      timeRange: {
        start: new Date(),
        end: new Date()
      }
    };
  }

  /**
   * Create empty network metrics structure
   */
  private createEmptyNetworkMetrics(): NetworkMetrics {
    return {
      ledgerNumber: 0,
      transactionThroughput: 0,
      averageFee: 0,
      totalAccounts: 0,
      networkHealth: 'healthy',
      timestamp: new Date()
    };
  }

  /**
   * Generate insights from metrics data
   */
  private generateInsights(
    metrics: TransactionMetrics,
    topAccounts: AccountActivity[],
    topAssets: AssetMetric[]
  ): string[] {
    const insights: string[] = [];

    // Success rate insight
    const successRate = (metrics.successfulTransactions / metrics.totalTransactions) * 100;
    if (successRate < 95) {
      insights.push(`Transaction success rate is low at ${successRate.toFixed(1)}%`);
    }

    // High activity accounts
    const highActivityAccounts = topAccounts.filter(acc => acc.transactionCount > 100);
    if (highActivityAccounts.length > 0) {
      insights.push(`${highActivityAccounts.length} accounts with high transaction activity detected`);
    }

    // Volume concentration
    if (topAssets.length > 0) {
      const topAssetVolume = topAssets[0].volume;
      const totalVolume = metrics.totalVolume;
      const concentration = (topAssetVolume / totalVolume) * 100;
      
      if (concentration > 80) {
        insights.push(`Transaction volume is highly concentrated (${concentration.toFixed(1)}% in top asset)`);
      }
    }

    // Transaction throughput
    if (metrics.transactionsPerSecond < 1) {
      insights.push('Low transaction throughput detected');
    } else if (metrics.transactionsPerSecond > 10) {
      insights.push('High transaction throughput detected');
    }

    return insights;
  }

  /**
   * Start periodic metrics calculation
   */
  private startPeriodicCalculation(): void {
    // Calculate metrics every minute
    setInterval(() => {
      try {
        // Update real-time metrics timestamp
        this.realtimeMetrics.timeRange.end = new Date();
        
        // Process any remaining transactions in buffer
        if (this.transactionBuffer.length > 0) {
          this.processBatch();
        }
        
        // Clean up old account activities (keep only last 24 hours)
        this.cleanupOldData();
        
      } catch (error) {
        console.error('Error in periodic metrics calculation:', error);
      }
    }, 60000); // 1 minute
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago

    // Clean up old account activities
    for (const [accountId, activity] of this.accountActivityMap.entries()) {
      if (activity.lastSeen < cutoffTime) {
        this.accountActivityMap.delete(accountId);
      }
    }

    // Clean up old chart data points
    ['volume', 'count', 'alerts'].forEach(type => {
      const typedType = type as 'volume' | 'count' | 'alerts';
      this.chartDataPoints[typedType] = this.chartDataPoints[typedType].filter(
        point => point.timestamp > cutoffTime
      );
    });
  }
}