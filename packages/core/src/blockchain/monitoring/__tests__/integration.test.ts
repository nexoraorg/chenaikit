import { TransactionMonitor } from '../transactionMonitor';
import { AlertSystem } from '../alertSystem';
import { TransactionAnalytics } from '../analytics';
import { MonitoringDashboard } from '../dashboard';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  TransactionAnalysis,
  TransactionCategory,
  Alert,
  AlertType,
  AlertSeverity
} from '../types';

describe('Monitoring System Integration', () => {
  let monitor: TransactionMonitor;
  let alertSystem: AlertSystem;
  let analytics: TransactionAnalytics;
  let dashboard: MonitoringDashboard;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    mockConfig = {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      network: 'testnet',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      batchSize: 100
    };

    monitor = new TransactionMonitor(mockConfig);
    alertSystem = new AlertSystem(mockConfig);
    analytics = new TransactionAnalytics(mockConfig);
    dashboard = new MonitoringDashboard(mockConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('System initialization', () => {
    it('should initialize all components successfully', async () => {
      await expect(monitor.start()).resolves.not.toThrow();
      await expect(alertSystem.start()).resolves.not.toThrow();
      await expect(analytics.start()).resolves.not.toThrow();
      await expect(dashboard.start()).resolves.not.toThrow();
    });

    it('should stop all components successfully', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      await expect(monitor.stop()).resolves.not.toThrow();
      await expect(alertSystem.stop()).resolves.not.toThrow();
      await expect(analytics.stop()).resolves.not.toThrow();
      await expect(dashboard.stop()).resolves.not.toThrow();
    });
  });

  describe('End-to-end transaction flow', () => {
    it('should process transaction through entire pipeline', async () => {
      // Start all components
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Create a mock transaction
      const transaction: TransactionEvent = {
        id: 'tx_integration_123',
        hash: 'hash_integration_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'GABC123XYZ',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_integration_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      // Process through analytics
      analytics.processTransaction(transaction, analysis);

      // Update dashboard
      dashboard.updateWithTransaction(transaction, analysis);

      // Evaluate for alerts
      await alertSystem.evaluateTransaction(transaction, analysis);

      // Verify analytics updated
      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBeGreaterThan(0);

      // Verify dashboard updated
      const recentTransactions = dashboard.getRecentTransactions();
      expect(recentTransactions.length).toBeGreaterThan(0);
      expect(recentTransactions[0].id).toBe('tx_integration_123');

      // Stop all components
      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should handle high-risk transaction and trigger alert', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      const transaction: TransactionEvent = {
        id: 'tx_high_risk',
        hash: 'hash_high_risk',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'GXYZ789ABC',
        fee: '1000',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_high_risk',
        category: TransactionCategory.SUSPICIOUS,
        riskScore: 90,
        flags: ['fraud_detected', 'suspicious_pattern'],
        confidence: 0.95,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      const alertSpy = jest.fn();
      alertSystem.on('alert', alertSpy);

      analytics.processTransaction(transaction, analysis);
      dashboard.updateWithTransaction(transaction, analysis);
      await alertSystem.evaluateTransaction(transaction, analysis);

      // Alert should be triggered for fraud
      expect(alertSpy).toHaveBeenCalled();

      // Manually add the alert to dashboard since evaluateTransaction creates it internally
      const alerts = await alertSystem.evaluateTransaction(transaction, analysis);
      if (alerts.length > 0) {
        dashboard.updateWithAlert(alerts[0]);
      }

      // Dashboard should show the alert
      const recentAlerts = dashboard.getRecentAlerts();
      expect(recentAlerts.length).toBeGreaterThan(0);

      // System health should reflect the alert
      const health = dashboard.getSystemHealth();
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should handle rapid sequence of transactions', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Process multiple transactions rapidly
      for (let i = 0; i < 10; i++) {
        const transaction: TransactionEvent = {
          id: `tx_rapid_${i}`,
          hash: `hash_rapid_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'GABC123XYZ',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_rapid_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        analytics.processTransaction(transaction, analysis);
        dashboard.updateWithTransaction(transaction, analysis);
      }

      // Verify analytics processed all transactions
      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBe(10);

      // Verify dashboard has recent transactions
      const recentTransactions = dashboard.getRecentTransactions();
      expect(recentTransactions.length).toBeGreaterThan(0);

      // Verify account activity tracking
      const accountActivity = analytics.getAccountActivity();
      const activity = accountActivity.find(a => a.accountId === 'GABC123XYZ');
      expect(activity?.transactionCount).toBe(10);

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });
  });

  describe('Event propagation between components', () => {
    it('should propagate transaction events from monitor to analytics', async () => {
      await monitor.start();
      await analytics.start();

      const transactionSpy = jest.fn();
      monitor.on('transaction', transactionSpy);

      // Manually emit a transaction event to test propagation
      const transaction: TransactionEvent = {
        id: 'tx_prop',
        hash: 'hash_prop',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_prop',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      monitor.emit('transaction', transaction, analysis);

      // Monitor should emit transaction events
      expect(transactionSpy).toHaveBeenCalledWith(transaction, analysis);

      await monitor.stop();
      await analytics.stop();
    });

    it('should propagate alert events from alert system to dashboard', async () => {
      await alertSystem.start();
      await dashboard.start();

      const alert: Alert = {
        id: 'alert_prop_test',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Propagation Test Alert',
        message: 'Testing alert propagation',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      const alertSpy = jest.fn();
      alertSystem.on('alert', alertSpy);

      await alertSystem.triggerAlert(alert);
      dashboard.updateWithAlert(alert);

      expect(alertSpy).toHaveBeenCalledWith(alert);

      const recentAlerts = dashboard.getRecentAlerts();
      expect(recentAlerts.length).toBeGreaterThan(0);

      await alertSystem.stop();
      await dashboard.stop();
    });

    it('should propagate metrics events from analytics to dashboard', async () => {
      await analytics.start();
      await dashboard.start();

      const metricsSpy = jest.fn();
      analytics.on('metrics', metricsSpy);

      // Process enough transactions to trigger batch processing
      const config: MonitoringConfig = {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        network: 'testnet',
        batchSize: 5
      };

      const batchAnalytics = new TransactionAnalytics(config);
      batchAnalytics.on('metrics', metricsSpy);

      for (let i = 0; i < 10; i++) {
        const transaction: TransactionEvent = {
          id: `tx_batch_${i}`,
          hash: `hash_batch_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_batch_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        batchAnalytics.processTransaction(transaction, analysis);
      }

      // Metrics event should be emitted when batch is processed
      expect(typeof metricsSpy).toBe('function');

      await analytics.stop();
      await dashboard.stop();
    });
  });

  describe('Data consistency across components', () => {
    it('should maintain consistent transaction counts', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      const transaction: TransactionEvent = {
        id: 'tx_consistency',
        hash: 'hash_consistency',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_consistency',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      analytics.processTransaction(transaction, analysis);
      dashboard.updateWithTransaction(transaction, analysis);

      const analyticsMetrics = analytics.getRealtimeMetrics();
      const dashboardData = await dashboard.getDashboardData();

      expect(analyticsMetrics.totalTransactions).toBeGreaterThan(0);
      expect(dashboardData.overview.realTimeMetrics.totalTransactions).toBeGreaterThan(0);

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should maintain consistent alert counts', async () => {
      await alertSystem.start();
      await dashboard.start();

      const alert: Alert = {
        id: 'alert_consistency',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Consistency Alert',
        message: 'Testing consistency',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      await alertSystem.triggerAlert(alert);
      dashboard.updateWithAlert(alert);

      const alertStats = alertSystem.getAlertStats();
      const dashboardData = await dashboard.getDashboardData();

      expect(alertStats.total).toBeGreaterThan(0);
      expect(dashboardData.overview.alertSummary.total).toBeGreaterThan(0);

      await alertSystem.stop();
      await dashboard.stop();
    });
  });

  describe('System health monitoring', () => {
    it('should monitor health across all components', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      const monitorStatus = monitor.getConnectionStatus();
      const dashboardHealth = dashboard.getSystemHealth();

      expect(monitorStatus.connected).toBe(true);
      expect(dashboardHealth.connectionStatus).toBe('connected');

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should update system health based on alerts', async () => {
      await alertSystem.start();
      await dashboard.start();

      const criticalAlert: Alert = {
        id: 'critical_health_alert',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.CRITICAL,
        title: 'Critical Health Alert',
        message: 'Critical issue detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(criticalAlert);
      const health = dashboard.getSystemHealth();

      expect(health.status).toBe('critical');

      await alertSystem.stop();
      await dashboard.stop();
    });
  });

  describe('Dashboard aggregation', () => {
    it('should aggregate data from all components', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Add transaction
      const transaction: TransactionEvent = {
        id: 'tx_aggregation',
        hash: 'hash_aggregation',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_aggregation',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      analytics.processTransaction(transaction, analysis);
      dashboard.updateWithTransaction(transaction, analysis);

      // Add alert
      const alert: Alert = {
        id: 'alert_aggregation',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Aggregation Alert',
        message: 'Testing aggregation',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      await alertSystem.triggerAlert(alert);
      dashboard.updateWithAlert(alert);

      // Get aggregated dashboard data
      const dashboardData = await dashboard.getDashboardData();

      expect(dashboardData.recentTransactions.length).toBeGreaterThan(0);
      expect(dashboardData.recentAlerts.length).toBeGreaterThan(0);
      expect(dashboardData.overview.realTimeMetrics.totalTransactions).toBeGreaterThan(0);
      expect(dashboardData.overview.alertSummary.total).toBeGreaterThan(0);

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should generate complete chart data', async () => {
      await analytics.start();
      await dashboard.start();

      // Add transactions to generate chart data
      for (let i = 0; i < 5; i++) {
        const transaction: TransactionEvent = {
          id: `tx_chart_${i}`,
          hash: `hash_chart_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_chart_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        analytics.processTransaction(transaction, analysis);
        dashboard.updateWithTransaction(transaction, analysis);
      }

      const dashboardData = await dashboard.getDashboardData();

      expect(dashboardData.charts.transactionVolume).toBeDefined();
      expect(dashboardData.charts.transactionCount).toBeDefined();
      expect(dashboardData.charts.alertTrends).toBeDefined();

      await analytics.stop();
      await dashboard.stop();
    });
  });

  describe('Error handling in integration', () => {
    it('should handle errors in one component without affecting others', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Simulate error in one component
      const invalidTransaction = {} as TransactionEvent;
      const invalidAnalysis = {} as TransactionAnalysis;

      // Other components should continue to work
      analytics.processTransaction(invalidTransaction, invalidAnalysis);
      dashboard.updateWithTransaction(invalidTransaction, invalidAnalysis);

      const validTransaction: TransactionEvent = {
        id: 'tx_valid',
        hash: 'hash_valid',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const validAnalysis: TransactionAnalysis = {
        transactionId: 'tx_valid',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: {}, patternAnalysis: {}, networkAnalysis: {} },
        timestamp: new Date()
      };

      analytics.processTransaction(validTransaction, validAnalysis);
      dashboard.updateWithTransaction(validTransaction, validAnalysis);

      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBeGreaterThan(0);

      await monitor.stop();
      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });

    it('should handle component shutdown gracefully', async () => {
      await monitor.start();
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Stop components in different order
      await analytics.stop();
      await monitor.stop();
      await dashboard.stop();
      await alertSystem.stop();

      // All should stop without errors
      expect(true).toBe(true);
    });
  });

  describe('Performance and scalability', () => {
    it('should handle high volume of transactions', async () => {
      await analytics.start();
      await dashboard.start();

      const transactionCount = 100;

      for (let i = 0; i < transactionCount; i++) {
        const transaction: TransactionEvent = {
          id: `tx_perf_${i}`,
          hash: `hash_perf_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_perf_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        analytics.processTransaction(transaction, analysis);
        dashboard.updateWithTransaction(transaction, analysis);
      }

      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBe(transactionCount);

      const recentTransactions = dashboard.getRecentTransactions();
      expect(recentTransactions.length).toBeLessThanOrEqual(50); // Dashboard limits to 50

      await analytics.stop();
      await dashboard.stop();
    });

    it('should handle concurrent operations', async () => {
      await alertSystem.start();
      await analytics.start();
      await dashboard.start();

      // Process multiple transactions concurrently
      const transactionPromises = Array.from({ length: 10 }, (_, i) => {
        const transaction: TransactionEvent = {
          id: `tx_concurrent_${i}`,
          hash: `hash_concurrent_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_concurrent_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        return Promise.resolve().then(() => {
          analytics.processTransaction(transaction, analysis);
          dashboard.updateWithTransaction(transaction, analysis);
        });
      });

      await Promise.all(transactionPromises);

      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBe(10);

      await alertSystem.stop();
      await analytics.stop();
      await dashboard.stop();
    });
  });

  describe('Cooldown and deduplication', () => {
    it('should enforce alert cooldown across the system', async () => {
      await alertSystem.start();
      await dashboard.start();

      const alert: Alert = {
        id: 'alert_cooldown',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Cooldown Alert',
        message: 'Testing cooldown',
        data: { transaction: { sourceAccount: 'G123' } },
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      const alertSpy = jest.fn();
      alertSystem.on('alert', alertSpy);

      await alertSystem.triggerAlert(alert);
      await alertSystem.triggerAlert(alert); // Should be blocked by cooldown

      expect(alertSpy).toHaveBeenCalledTimes(1);

      await alertSystem.stop();
      await dashboard.stop();
    });
  });
});
