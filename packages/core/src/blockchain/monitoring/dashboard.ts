import { EventEmitter } from 'eventemitter3';
import NodeCache from 'node-cache';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  LedgerEvent,
  TransactionAnalysis,
  DashboardData,
  Alert,
  AlertSummary,
  SystemHealth,
  TransactionMetrics,
  NetworkMetrics,
  AccountActivity,
  ChartDataPoint
} from './types';

/**
 * Monitoring dashboard data aggregation and real-time updates
 */
export class MonitoringDashboard extends EventEmitter {
  private config: MonitoringConfig;
  private dashboardCache: NodeCache;
  private recentTransactions: TransactionEvent[] = [];
  private recentAlerts: Alert[] = [];
  private systemHealth: SystemHealth;
  private metricsHistory: TransactionMetrics[] = [];
  private lastUpdateTime: Date = new Date();

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    
    // Cache for dashboard data (refresh every 30 seconds)
    this.dashboardCache = new NodeCache({ 
      stdTTL: 30,
      checkperiod: 10
    });

    // Initialize system health
    this.systemHealth = {
      status: 'healthy',
      uptime: 0,
      connectionStatus: 'disconnected',
      processingLatency: 0,
      memoryUsage: 0,
      lastHealthCheck: new Date()
    };

    this.startHealthMonitoring();
  }

  /**
   * Start the dashboard system
   */
  public async start(): Promise<void> {
    this.systemHealth.connectionStatus = 'connected';
    this.systemHealth.status = 'healthy';
    console.log('Monitoring dashboard started');
  }

  /**
   * Stop the dashboard system
   */
  public async stop(): Promise<void> {
    this.dashboardCache.flushAll();
    this.systemHealth.connectionStatus = 'disconnected';
    console.log('Monitoring dashboard stopped');
  }

  /**
   * Get complete dashboard data
   */
  public async getDashboardData(): Promise<DashboardData> {
    const cacheKey = 'dashboard_data';
    
    // Check cache first
    let dashboardData = this.dashboardCache.get(cacheKey) as DashboardData;
    if (dashboardData) {
      return dashboardData;
    }

    // Generate fresh dashboard data
    dashboardData = await this.generateDashboardData();
    
    // Cache the data
    this.dashboardCache.set(cacheKey, dashboardData);
    
    return dashboardData;
  }

  /**
   * Update dashboard with new transaction
   */
  public updateWithTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    try {
      // Add to recent transactions (keep last 50)
      this.recentTransactions.unshift(transaction);
      if (this.recentTransactions.length > 50) {
        this.recentTransactions.pop();
      }

      // Update processing latency
      const processingTime = Date.now() - new Date(transaction.createdAt).getTime();
      this.systemHealth.processingLatency = processingTime;

      // Invalidate cache to force refresh
      this.dashboardCache.del('dashboard_data');
      
      // Emit update event for real-time updates
      this.emit('transaction_update', { transaction, analysis });

    } catch (error) {
      console.error('Error updating dashboard with transaction:', error);
    }
  }

  /**
   * Update dashboard with new ledger
   */
  public updateWithLedger(ledger: LedgerEvent): void {
    try {
      // Update system health based on ledger data
      this.updateSystemHealthFromLedger(ledger);
      
      // Invalidate cache
      this.dashboardCache.del('dashboard_data');
      
      // Emit update event
      this.emit('ledger_update', ledger);

    } catch (error) {
      console.error('Error updating dashboard with ledger:', error);
    }
  }

  /**
   * Update dashboard with new alert
   */
  public updateWithAlert(alert: Alert): void {
    try {
      // Add to recent alerts (keep last 20)
      this.recentAlerts.unshift(alert);
      if (this.recentAlerts.length > 20) {
        this.recentAlerts.pop();
      }

      // Update system health if critical alert
      if (alert.severity === 'critical') {
        this.systemHealth.status = 'critical';
      } else if (alert.severity === 'high' && this.systemHealth.status === 'healthy') {
        this.systemHealth.status = 'degraded';
      }

      // Invalidate cache
      this.dashboardCache.del('dashboard_data');
      
      // Emit update event
      this.emit('alert_update', alert);

    } catch (error) {
      console.error('Error updating dashboard with alert:', error);
    }
  }

  /**
   * Get real-time metrics stream
   */
  public getRealtimeStream(): EventEmitter {
    return this;
  }

  /**
   * Get system health status
   */
  public getSystemHealth(): SystemHealth {
    this.updateSystemHealth();
    return { ...this.systemHealth };
  }

  /**
   * Get recent transactions
   */
  public getRecentTransactions(limit: number = 20): TransactionEvent[] {
    return this.recentTransactions.slice(0, limit);
  }

  /**
   * Get recent alerts
   */
  public getRecentAlerts(limit: number = 10): Alert[] {
    return this.recentAlerts.slice(0, limit);
  }

  /**
   * Get alert summary statistics
   */
  public getAlertSummary(): AlertSummary {
    const summary: AlertSummary = {
      total: this.recentAlerts.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byType: {
        high_value_transaction: 0,
        rapid_transactions: 0,
        suspicious_pattern: 0,
        fraud_detected: 0,
        system_error: 0,
        connection_lost: 0
      },
      unacknowledged: 0
    };

    this.recentAlerts.forEach(alert => {
      summary.bySeverity[alert.severity]++;
      summary.byType[alert.type]++;
      if (!alert.acknowledged) {
        summary.unacknowledged++;
      }
    });

    return summary;
  }

  /**
   * Generate chart data for visualizations
   */
  public generateChartData(): {
    transactionVolume: ChartDataPoint[];
    transactionCount: ChartDataPoint[];
    alertTrends: ChartDataPoint[];
  } {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Generate transaction volume chart (last 24 hours)
    const transactionVolume = this.generateVolumeChart(last24Hours, now);
    
    // Generate transaction count chart
    const transactionCount = this.generateCountChart(last24Hours, now);
    
    // Generate alert trends chart
    const alertTrends = this.generateAlertTrendsChart(last24Hours, now);

    return {
      transactionVolume,
      transactionCount,
      alertTrends
    };
  }

  /**
   * Get top performing accounts
   */
  public getTopAccounts(limit: number = 10): AccountActivity[] {
    // This would typically query the analytics engine
    // For now, generate mock data based on recent transactions
    const accountMap = new Map<string, AccountActivity>();

    this.recentTransactions.forEach(tx => {
      const account = accountMap.get(tx.sourceAccount) || {
        accountId: tx.sourceAccount,
        transactionCount: 0,
        totalSent: 0,
        totalReceived: 0,
        firstSeen: new Date(tx.createdAt),
        lastSeen: new Date(tx.createdAt),
        riskScore: 0,
        flags: []
      };

      account.transactionCount++;
      account.lastSeen = new Date(tx.createdAt);
      account.totalSent += parseFloat(tx.fee) * 1000; // Rough estimation

      accountMap.set(tx.sourceAccount, account);
    });

    return Array.from(accountMap.values())
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, limit);
  }

  /**
   * Export dashboard data for external use
   */
  public async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const dashboardData = await this.getDashboardData();
    
    if (format === 'json') {
      return JSON.stringify(dashboardData, null, 2);
    } else {
      // Simple CSV export for transactions
      const csv = ['Timestamp,Hash,Source Account,Fee,Successful'];
      
      dashboardData.recentTransactions.forEach(tx => {
        csv.push(`${tx.createdAt},${tx.hash},${tx.sourceAccount},${tx.fee},${tx.successful}`);
      });
      
      return csv.join('\n');
    }
  }

  /**
   * Generate complete dashboard data
   */
  private async generateDashboardData(): Promise<DashboardData> {
    try {
      // Generate mock real-time metrics
      const realtimeMetrics: TransactionMetrics = {
        totalTransactions: this.recentTransactions.length,
        successfulTransactions: this.recentTransactions.filter(tx => tx.successful).length,
        failedTransactions: this.recentTransactions.filter(tx => !tx.successful).length,
        totalVolume: this.recentTransactions.reduce((sum, tx) => sum + (parseFloat(tx.fee) * 1000), 0),
        averageTransactionValue: 0,
        transactionsPerSecond: this.calculateTPS(),
        uniqueAccounts: new Set(this.recentTransactions.map(tx => tx.sourceAccount)).size,
        topAssets: [],
        timeRange: {
          start: new Date(Date.now() - (60 * 60 * 1000)), // Last hour
          end: new Date()
        }
      };

      realtimeMetrics.averageTransactionValue = 
        realtimeMetrics.totalTransactions > 0 
          ? realtimeMetrics.totalVolume / realtimeMetrics.totalTransactions 
          : 0;

      // Generate mock network metrics
      const networkMetrics: NetworkMetrics = {
        ledgerNumber: Math.floor(Date.now() / 1000), // Mock ledger number
        transactionThroughput: realtimeMetrics.transactionsPerSecond,
        averageFee: 100, // Mock average fee
        totalAccounts: 1000000, // Mock total accounts
        networkHealth: this.systemHealth.status,
        timestamp: new Date()
      };

      const dashboardData: DashboardData = {
        overview: {
          realTimeMetrics: realtimeMetrics,
          networkStatus: networkMetrics,
          alertSummary: this.getAlertSummary(),
          systemHealth: this.getSystemHealth()
        },
        recentTransactions: this.getRecentTransactions(20),
        recentAlerts: this.getRecentAlerts(10),
        topAccounts: this.getTopAccounts(10),
        charts: this.generateChartData()
      };

      return dashboardData;

    } catch (error) {
      console.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  /**
   * Calculate transactions per second
   */
  private calculateTPS(): number {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - (60 * 1000));
    
    const recentTxCount = this.recentTransactions.filter(tx => 
      new Date(tx.createdAt) >= oneMinuteAgo
    ).length;
    
    return recentTxCount / 60; // TPS over last minute
  }

  /**
   * Generate volume chart data
   */
  private generateVolumeChart(startTime: Date, endTime: Date): ChartDataPoint[] {
    const points: ChartDataPoint[] = [];
    const intervalMs = 60 * 60 * 1000; // 1 hour intervals
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + intervalMs);
      
      const intervalTransactions = this.recentTransactions.filter(tx => {
        const txTime = new Date(tx.createdAt);
        return txTime >= intervalStart && txTime < intervalEnd;
      });
      
      const volume = intervalTransactions.reduce((sum, tx) => 
        sum + (parseFloat(tx.fee) * 1000), 0
      );
      
      points.push({
        timestamp: intervalStart,
        value: volume,
        label: intervalStart.toLocaleTimeString()
      });
    }
    
    return points;
  }

  /**
   * Generate transaction count chart data
   */
  private generateCountChart(startTime: Date, endTime: Date): ChartDataPoint[] {
    const points: ChartDataPoint[] = [];
    const intervalMs = 60 * 60 * 1000; // 1 hour intervals
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + intervalMs);
      
      const count = this.recentTransactions.filter(tx => {
        const txTime = new Date(tx.createdAt);
        return txTime >= intervalStart && txTime < intervalEnd;
      }).length;
      
      points.push({
        timestamp: intervalStart,
        value: count,
        label: intervalStart.toLocaleTimeString()
      });
    }
    
    return points;
  }

  /**
   * Generate alert trends chart data
   */
  private generateAlertTrendsChart(startTime: Date, endTime: Date): ChartDataPoint[] {
    const points: ChartDataPoint[] = [];
    const intervalMs = 60 * 60 * 1000; // 1 hour intervals
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + intervalMs);
      
      const count = this.recentAlerts.filter(alert => {
        return alert.timestamp >= intervalStart && alert.timestamp < intervalEnd;
      }).length;
      
      points.push({
        timestamp: intervalStart,
        value: count,
        label: intervalStart.toLocaleTimeString()
      });
    }
    
    return points;
  }

  /**
   * Update system health metrics
   */
  private updateSystemHealth(): void {
    this.systemHealth.lastHealthCheck = new Date();
    
    // Calculate uptime (mock calculation)
    this.systemHealth.uptime = Date.now() - this.lastUpdateTime.getTime();
    
    // Update memory usage (mock)
    this.systemHealth.memoryUsage = Math.random() * 100;
    
    // Determine overall health status
    const alertSummary = this.getAlertSummary();
    
    if (alertSummary.bySeverity.critical > 0) {
      this.systemHealth.status = 'critical';
    } else if (alertSummary.bySeverity.high > 5) {
      this.systemHealth.status = 'degraded';
    } else if (this.systemHealth.connectionStatus !== 'connected') {
      this.systemHealth.status = 'degraded';
    } else {
      this.systemHealth.status = 'healthy';
    }
  }

  /**
   * Update system health based on ledger data
   */
  private updateSystemHealthFromLedger(ledger: LedgerEvent): void {
    // Update connection status based on recent ledger activity
    this.systemHealth.connectionStatus = 'connected';
    
    // Update network health assessment
    if (ledger.transactionCount > 1000) {
      // High activity is good
    } else if (ledger.transactionCount < 10) {
      this.systemHealth.status = 'degraded';
    }
  }

  /**
   * Start health monitoring interval
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateSystemHealth();
      
      // Emit health update
      this.emit('health_update', this.systemHealth);
      
    }, 30000); // Update every 30 seconds
  }
}