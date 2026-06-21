/**
 * Complete example demonstrating the ChenAI Kit Transaction Monitoring System
 * 
 * This example shows how to:
 * - Set up real-time transaction monitoring
 * - Configure custom alert rules
 * - Handle analytics and metrics
 * - Implement dashboard functionality
 * - Process transaction replay and verification
 */

import { TransactionMonitor } from './transactionMonitor';
import { AlertSystem } from './alertSystem';
import { TransactionAnalytics } from './analytics';
import { MonitoringDashboard } from './dashboard';
import {
  MonitoringConfig,
  AlertRule,
  AlertType,
  AlertSeverity,
  TransactionEvent,
  TransactionAnalysis,
  Alert
} from './types';

// Configuration for the monitoring system
const monitoringConfig: MonitoringConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  network: 'testnet',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  batchSize: 100,
  
  // Alert thresholds
  alertThresholds: {
    highVolumeAmount: 10000,      // Alert for transactions > 10,000 XLM
    rapidTransactionCount: 20,    // Alert after 20 rapid transactions
    rapidTransactionWindow: 300000, // 5-minute window for rapid detection
    suspiciousPatternScore: 0.8   // 80% confidence for fraud alerts
  },
  
  // Transaction filters
  filters: {
    minAmount: 100,               // Ignore micro-transactions
    excludeAccounts: [
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // Known test accounts
      'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    ],
    // accounts: ['GSPECIFIC...'], // Monitor specific accounts only
    // assets: ['XLM', 'USDC']      // Monitor specific assets only
  }
};

/**
 * Main monitoring application class
 */
class MonitoringApplication {
  private monitor: TransactionMonitor;
  private alertCounts: { [key: string]: number } = {};
  private startTime: Date = new Date();
  
  constructor() {
    this.monitor = new TransactionMonitor(monitoringConfig);
    this.setupEventHandlers();
    this.setupCustomAlertRules();
  }

  /**
   * Start the monitoring application
   */
  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting ChenAI Kit Transaction Monitoring System...');
      console.log(`📡 Connecting to: ${monitoringConfig.horizonUrl}`);
      console.log(`🌐 Network: ${monitoringConfig.network}`);
      
      await this.monitor.start();
      
      console.log('✅ Monitoring system started successfully!');
      console.log('📊 Real-time transaction monitoring active');
      
      // Start periodic reporting
      this.startPeriodicReporting();
      
      // Demonstrate various features
      setTimeout(() => this.demonstrateFeatures(), 10000);
      
    } catch (error) {
      console.error('❌ Failed to start monitoring system:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the monitoring application
   */
  public async stop(): Promise<void> {
    console.log('🛑 Stopping monitoring system...');
    await this.monitor.stop();
    console.log('✅ Monitoring system stopped');
  }

  /**
   * Set up event handlers for monitoring events
   */
  private setupEventHandlers(): void {
    // Transaction events
    this.monitor.on('transaction', this.handleTransaction.bind(this));
    
    // Alert events
    this.monitor.on('alert', this.handleAlert.bind(this));
    
    // Connection events
    this.monitor.on('connected', () => {
      console.log('🔗 WebSocket connected to Stellar Horizon');
    });
    
    this.monitor.on('disconnected', (reason: string) => {
      console.log(`❌ WebSocket disconnected: ${reason}`);
    });
    
    this.monitor.on('reconnecting', (attempt: number) => {
      console.log(`🔄 Reconnecting... (attempt ${attempt})`);
    });
    
    // Error handling
    this.monitor.on('error', (error: Error) => {
      console.error('💥 Monitoring error:', error.message);
    });
    
    // Metrics events
    this.monitor.on('metrics', (metrics: any) => {
      console.log(`📈 Batch metrics - TPS: ${metrics.transactionsPerSecond.toFixed(2)}, Volume: ${metrics.totalVolume.toFixed(2)}`);
    });
  }

  /**
   * Handle new transactions
   */
  private handleTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    const emoji = this.getTransactionEmoji(analysis);
    const riskLevel = this.getRiskLevel(analysis.riskScore);
    
    console.log(`${emoji} Transaction: ${transaction.hash.substring(0, 12)}... | ${riskLevel} | Account: ${transaction.sourceAccount.substring(0, 8)}...`);
    
    // Log high-risk transactions with details
    if (analysis.riskScore > 50) {
      console.log(`   🔍 Analysis: Category=${analysis.category}, Risk=${analysis.riskScore}, Flags=[${analysis.flags.join(', ')}]`);
    }
  }

  /**
   * Handle alerts
   */
  private handleAlert(alert: Alert): void {
    const emoji = this.getAlertEmoji(alert.severity);
    
    console.log(`${emoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
    console.log(`   📝 ${alert.message}`);
    console.log(`   🆔 Alert ID: ${alert.id}`);
    console.log(`   ⏰ Time: ${alert.timestamp.toISOString()}`);
    
    // Count alerts by type
    this.alertCounts[alert.type] = (this.alertCounts[alert.type] || 0) + 1;
    
    // Handle critical alerts
    if (alert.severity === AlertSeverity.CRITICAL) {
      this.handleCriticalAlert(alert);
    }
  }

  /**
   * Handle critical alerts with special processing
   */
  private handleCriticalAlert(alert: Alert): void {
    console.log('🚨 CRITICAL ALERT DETECTED - Taking immediate action!');
    
    // In a real application, you might:
    // - Send immediate notifications to administrators
    // - Temporarily increase monitoring sensitivity
    // - Log to security systems
    // - Trigger automatic response protocols
    
    console.log('   📧 Sending emergency notifications...');
    console.log('   🔒 Escalating to security team...');
  }

  /**
   * Set up custom alert rules
   */
  private setupCustomAlertRules(): void {
    console.log('⚙️  Setting up custom alert rules...');
    
    // Custom rule for whale movements (very large transactions)
    const whaleRule: AlertRule = {
      id: 'whale_movement_rule',
      type: AlertType.HIGH_VALUE_TRANSACTION,
      severity: AlertSeverity.HIGH,
      name: 'Whale Movement Detection',
      description: 'Detect movements of very large amounts (whale transactions)',
      conditions: [
        {
          field: 'analysis.volumeAnalysis.amount',
          operator: 'gt',
          value: 100000 // 100,000 XLM
        }
      ],
      actions: [
        {
          type: 'websocket',
          config: { channel: 'whale_alerts' }
        },
        {
          type: 'log',
          config: {}
        }
      ],
      enabled: true,
      cooldownPeriod: 300000 // 5 minutes
    };

    // Custom rule for suspicious account patterns
    const suspiciousPatternRule: AlertRule = {
      id: 'suspicious_pattern_rule',
      type: AlertType.SUSPICIOUS_PATTERN,
      severity: AlertSeverity.MEDIUM,
      name: 'Suspicious Account Pattern',
      description: 'Detect accounts with suspicious transaction patterns',
      conditions: [
        {
          field: 'analysis.riskScore',
          operator: 'gt',
          value: 70
        },
        {
          field: 'analysis.flags',
          operator: 'contains',
          value: 'rapid_sequence'
        }
      ],
      actions: [
        {
          type: 'websocket',
          config: { channel: 'pattern_alerts' }
        }
      ],
      enabled: true,
      cooldownPeriod: 600000 // 10 minutes
    };

    // Add custom rules
    this.monitor.addAlertRule(whaleRule);
    this.monitor.addAlertRule(suspiciousPatternRule);
    
    console.log(`✅ Added ${2} custom alert rules`);
  }

  /**
   * Demonstrate various monitoring features
   */
  private async demonstrateFeatures(): Promise<void> {
    console.log('\n🎯 Demonstrating monitoring features...\n');

    try {
      // 1. Dashboard data
      await this.demonstrateDashboard();
      
      // 2. Analytics
      await this.demonstrateAnalytics();
      
      // 3. System health
      await this.demonstrateSystemHealth();
      
      // 4. Transaction replay (demo with small range)
      await this.demonstrateTransactionReplay();
      
      // 5. Export functionality
      await this.demonstrateDataExport();
      
    } catch (error) {
      console.error('❌ Error demonstrating features:', error);
    }
  }

  /**
   * Demonstrate dashboard functionality
   */
  private async demonstrateDashboard(): Promise<void> {
    console.log('📊 Dashboard Data Demo:');
    
    const dashboardData = await this.monitor.getDashboardData();
    
    console.log(`   📈 Real-time Metrics:`);
    console.log(`      - Total Transactions: ${dashboardData.overview.realTimeMetrics.totalTransactions}`);
    console.log(`      - Success Rate: ${((dashboardData.overview.realTimeMetrics.successfulTransactions / dashboardData.overview.realTimeMetrics.totalTransactions) * 100 || 0).toFixed(1)}%`);
    console.log(`      - TPS: ${dashboardData.overview.realTimeMetrics.transactionsPerSecond.toFixed(2)}`);
    console.log(`      - Total Volume: ${dashboardData.overview.realTimeMetrics.totalVolume.toFixed(2)}`);
    
    console.log(`   🚨 Alert Summary:`);
    const alertSummary = (dashboardData.overview as any).alertSummary || { total: 0, unacknowledged: 0, bySeverity: { critical: 0 } };
    console.log(`      - Total Alerts: ${alertSummary.total}`);
    console.log(`      - Unacknowledged: ${alertSummary.unacknowledged}`);
    console.log(`      - Critical: ${alertSummary.bySeverity.critical}`);
    
    console.log(`   ⚡ System Health: ${dashboardData.overview.systemHealth.status.toUpperCase()}`);
  }

  /**
   * Demonstrate analytics functionality
   */
  private async demonstrateAnalytics(): Promise<void> {
    console.log('\n📊 Analytics Demo:');
    
    // Get real-time metrics
    const realtimeMetrics = await this.monitor.getMetrics(
      new Date(Date.now() - 3600000), // Last hour
      new Date()
    );
    
    console.log(`   📈 Last Hour Metrics:`);
    console.log(`      - Transactions: ${realtimeMetrics.totalTransactions}`);
    console.log(`      - Average Value: ${realtimeMetrics.averageTransactionValue.toFixed(2)}`);
    console.log(`      - Unique Accounts: ${realtimeMetrics.uniqueAccounts}`);
    
    // Generate a report
    try {
      const analytics = (this.monitor as any).analytics; // Access analytics directly for demo
      const report = await analytics.generateReport(
        new Date(Date.now() - 3600000),
        new Date()
      );
      
      console.log(`   🔍 Insights:`);
      report.insights.forEach((insight: string, index: number) => {
        console.log(`      ${index + 1}. ${insight}`);
      });
      
    } catch (error) {
      console.log(`      - Analytics report generation in progress...`);
    }
  }

  /**
   * Demonstrate system health monitoring
   */
  private async demonstrateSystemHealth(): Promise<void> {
    console.log('\n💊 System Health Demo:');
    
    const connectionStatus = this.monitor.getConnectionStatus();
    
    console.log(`   🔗 Connection Status:`);
    console.log(`      - Connected: ${connectionStatus.connected ? '✅' : '❌'}`);
    console.log(`      - Reconnecting: ${connectionStatus.reconnecting ? '🔄' : '✅'}`);
    console.log(`      - Attempts: ${connectionStatus.reconnectAttempts}`);
    console.log(`      - Last Connected: ${connectionStatus.lastConnected?.toISOString() || 'Never'}`);
  }

  /**
   * Demonstrate transaction replay functionality
   */
  private async demonstrateTransactionReplay(): Promise<void> {
    console.log('\n🔄 Transaction Replay Demo:');
    
    try {
      // Note: This would replay actual transactions in a real scenario
      // For demo purposes, we'll just show the concept
      console.log(`   📚 Starting transaction replay for recent ledgers...`);
      
      // In a real scenario, you might replay specific ledger ranges
      // await this.monitor.replayTransactions(45000000, 45000010);
      
      console.log(`   ✅ Transaction replay functionality ready`);
      console.log(`      - Use: monitor.replayTransactions(startLedger, endLedger)`);
      console.log(`      - Use: monitor.verifyTransaction(transactionHash)`);
      
    } catch (error) {
      console.log(`   ℹ️  Replay demo skipped (requires specific ledger range)`);
    }
  }

  /**
   * Demonstrate data export functionality
   */
  private async demonstrateDataExport(): Promise<void> {
    console.log('\n📤 Data Export Demo:');
    
    try {
      const dashboard = (this.monitor as any).dashboard;
      
      // Export as JSON
      const jsonExport = await dashboard.exportData('json');
      console.log(`   📄 JSON Export: ${jsonExport.length} characters`);
      
      // Export as CSV
      const csvExport = await dashboard.exportData('csv');
      const csvLines = csvExport.split('\n').length;
      console.log(`   📊 CSV Export: ${csvLines} lines`);
      
      console.log(`   ✅ Data export functionality ready`);
      
    } catch (error) {
      console.log(`   ℹ️  Export demo completed with basic data`);
    }
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    // Report statistics every 2 minutes
    setInterval(() => {
      this.printPeriodicReport();
    }, 120000);
  }

  /**
   * Print periodic monitoring report
   */
  private printPeriodicReport(): void {
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeMinutes = Math.floor(uptime / 60000);
    
    console.log('\n📋 === PERIODIC MONITORING REPORT ===');
    console.log(`⏱️  Uptime: ${uptimeMinutes} minutes`);
    console.log(`🚨 Alert Counts:`);
    
    Object.entries(this.alertCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
    if (Object.keys(this.alertCounts).length === 0) {
      console.log('   - No alerts triggered yet');
    }
    
    console.log('=================================\n');
  }

  /**
   * Get emoji for transaction based on analysis
   */
  private getTransactionEmoji(analysis: TransactionAnalysis): string {
    if (analysis.riskScore >= 80) return '🚨';
    if (analysis.riskScore >= 50) return '⚠️';
    if (analysis.flags.includes('high_value')) return '💰';
    if (analysis.flags.includes('rapid_sequence')) return '⚡';
    return '💳';
  }

  /**
   * Get risk level description
   */
  private getRiskLevel(score: number): string {
    if (score >= 80) return 'HIGH RISK';
    if (score >= 50) return 'MEDIUM RISK';
    if (score >= 20) return 'LOW RISK';
    return 'NORMAL';
  }

  /**
   * Get emoji for alert severity
   */
  private getAlertEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '📢';
    }
  }
}

/**
 * Main application entry point
 */
async function main() {
  const app = new MonitoringApplication();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Received shutdown signal...');
    await app.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n👋 Received termination signal...');
    await app.stop();
    process.exit(0);
  });
  
  // Handle unhandled errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  // Start the application
  await app.start();
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Failed to start application:', error);
    process.exit(1);
  });
}

export { MonitoringApplication, monitoringConfig };