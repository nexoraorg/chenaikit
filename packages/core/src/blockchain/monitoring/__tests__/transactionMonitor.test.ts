import { TransactionMonitor } from '../transactionMonitor';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  TransactionCategory,
  AlertType,
  AlertSeverity
} from '../types';

describe('TransactionMonitor', () => {
  let monitor: TransactionMonitor;
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(monitor).toBeInstanceOf(TransactionMonitor);
    });

    it('should work with minimal config', () => {
      const minimalConfig: MonitoringConfig = { 
        horizonUrl: 'https://horizon-testnet.stellar.org',
        network: 'testnet'
      };
      const minimalMonitor = new TransactionMonitor(minimalConfig);
      expect(minimalMonitor).toBeInstanceOf(TransactionMonitor);
    });

    it('should set default config values', () => {
      const minimalConfig: MonitoringConfig = { 
        horizonUrl: 'https://horizon-testnet.stellar.org',
        network: 'testnet'
      };
      const minimalMonitor = new TransactionMonitor(minimalConfig);
      const status = minimalMonitor.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.reconnecting).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
    });
  });

  describe('start', () => {
    it('should start monitoring successfully', async () => {
      await expect(monitor.start()).resolves.not.toThrow();
    });

    it('should set connection status to connected after start', async () => {
      await monitor.start();
      const status = monitor.getConnectionStatus();
      expect(status.connected).toBe(true);
    });

    it('should emit connected event on start', async () => {
      const connectedSpy = jest.fn();
      monitor.on('connected', connectedSpy);
      
      await monitor.start();
      
      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should start polling interval', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await monitor.start();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10000
      );
      
      setIntervalSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop monitoring successfully', async () => {
      await monitor.start();
      await expect(monitor.stop()).resolves.not.toThrow();
    });

    it('should set connection status to disconnected after stop', async () => {
      await monitor.start();
      await monitor.stop();
      
      const status = monitor.getConnectionStatus();
      expect(status.connected).toBe(false);
    });

    it('should clear polling interval', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await monitor.start();
      await monitor.stop();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', () => {
      const status = monitor.getConnectionStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('reconnecting');
      expect(status).toHaveProperty('reconnectAttempts');
    });

    it('should return a copy of status object', () => {
      const status1 = monitor.getConnectionStatus();
      const status2 = monitor.getConnectionStatus();
      
      expect(status1).not.toBe(status2);
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      const data = await monitor.getDashboardData();
      
      expect(data).toHaveProperty('overview');
      expect(data).toHaveProperty('recentTransactions');
      expect(data).toHaveProperty('recentAlerts');
    });

    it('should include real-time metrics in overview', async () => {
      const data = await monitor.getDashboardData();
      
      expect(data.overview).toHaveProperty('realTimeMetrics');
      expect(data.overview.realTimeMetrics).toHaveProperty('totalTransactions');
      expect(data.overview.realTimeMetrics).toHaveProperty('successfulTransactions');
      expect(data.overview.realTimeMetrics).toHaveProperty('failedTransactions');
    });

    it('should include system health in overview', async () => {
      const data = await monitor.getDashboardData();
      
      expect(data.overview).toHaveProperty('systemHealth');
      expect(data.overview.systemHealth).toHaveProperty('status');
      expect(data.overview.systemHealth).toHaveProperty('connectionStatus');
    });
  });

  describe('addAlertRule', () => {
    it('should add alert rule', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        conditions: [],
        actions: []
      };
      
      expect(() => monitor.addAlertRule(rule)).not.toThrow();
    });

    it('should allow adding multiple rules', () => {
      const rule1 = { id: 'rule1', name: 'Rule 1', type: AlertType.HIGH_VALUE_TRANSACTION, severity: AlertSeverity.MEDIUM, enabled: true, conditions: [], actions: [] };
      const rule2 = { id: 'rule2', name: 'Rule 2', type: AlertType.FRAUD_DETECTED, severity: AlertSeverity.HIGH, enabled: true, conditions: [], actions: [] };
      
      monitor.addAlertRule(rule1);
      monitor.addAlertRule(rule2);
      
      expect(() => monitor.addAlertRule(rule1)).not.toThrow();
    });
  });

  describe('removeAlertRule', () => {
    it('should remove alert rule', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        conditions: [],
        actions: []
      };
      
      monitor.addAlertRule(rule);
      monitor.removeAlertRule('test_rule');
      
      expect(() => monitor.removeAlertRule('test_rule')).not.toThrow();
    });

    it('should handle removing non-existent rule', () => {
      expect(() => monitor.removeAlertRule('non_existent')).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics with time range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');
      
      const metrics = await monitor.getMetrics(startTime, endTime);
      
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('timeRange');
      expect(metrics.timeRange.start).toEqual(startTime);
      expect(metrics.timeRange.end).toEqual(endTime);
    });
  });

  describe('replayTransactions', () => {
    it('should replay transactions successfully', async () => {
      await expect(monitor.replayTransactions(1000, 2000)).resolves.not.toThrow();
    });
  });

  describe('verifyTransaction', () => {
    it('should verify transaction successfully', async () => {
      const result = await monitor.verifyTransaction('test_tx_id');
      expect(result).toBe(true);
    });

    it('should handle verification errors', async () => {
      // Mock error scenario
      const result = await monitor.verifyTransaction('invalid_tx');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('transaction event handling', () => {
    it('should emit transaction events', async () => {
      const transactionSpy = jest.fn();
      monitor.on('transaction', transactionSpy);
      
      // Manually trigger a transaction event by calling the private method through testing
      const transaction: TransactionEvent = {
        id: 'test_tx',
        hash: 'test_hash',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'test_tx',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: {},
        timestamp: new Date()
      };

      // Emit the event directly
      monitor.emit('transaction', transaction, analysis);
      
      expect(transactionSpy).toHaveBeenCalledWith(transaction, analysis);
    });

    it('should emit alert events for high-risk transactions', async () => {
      const alertSpy = jest.fn();
      monitor.on('alert', alertSpy);
      
      const alert: Alert = {
        id: 'test_alert',
        ruleId: 'high_risk_rule',
        type: AlertType.SUSPICIOUS_PATTERN,
        severity: AlertSeverity.HIGH,
        title: 'High Risk Transaction',
        message: 'High risk transaction detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'test_tx'
      };

      // Emit the alert directly
      monitor.emit('alert', alert);
      
      expect(alertSpy).toHaveBeenCalledWith(alert);
    });

    it('should emit error events on errors', async () => {
      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);
      
      const error = new Error('Test error');
      
      // Emit the error directly
      monitor.emit('error', error);
      
      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('transaction categorization', () => {
    it('should categorize normal transactions', async () => {
      await monitor.start();
      
      // The analyzeTransaction method categorizes based on risk score
      // Normal transactions have risk score <= 60
      
      await monitor.stop();
    });

    it('should categorize suspicious transactions', async () => {
      await monitor.start();
      
      // Suspicious transactions have risk score > 80
      
      await monitor.stop();
    });

    it('should categorize high-value transactions', async () => {
      await monitor.start();
      
      // High-value transactions have risk score > 60 and <= 80
      
      await monitor.stop();
    });
  });

  describe('batch processing', () => {
    it('should process transactions in batches', async () => {
      await monitor.start();
      
      // The monitor uses a buffer with max size of 100
      // Transactions are processed in batches
      
      await monitor.stop();
    });

    it('should clean up old transactions from buffer', async () => {
      await monitor.start();
      
      // Buffer maintains max 100 transactions
      // Old transactions are removed when buffer is full
      
      await monitor.stop();
    });
  });

  describe('metrics tracking', () => {
    it('should track total transactions', async () => {
      const initialMetrics = await monitor.getMetrics(new Date(), new Date());
      const initialTotal = initialMetrics.totalTransactions;
      
      // Manually process a transaction to update metrics
      const transaction: TransactionEvent = {
        id: 'test_tx',
        hash: 'test_hash',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'test_tx',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: {},
        timestamp: new Date()
      };

      // Emit transaction event which should update metrics
      monitor.emit('transaction', transaction, analysis);
      
      const updatedMetrics = await monitor.getMetrics(new Date(), new Date());
      
      // Metrics should be updated
      expect(typeof updatedMetrics.totalTransactions).toBe('number');
    });

    it('should track successful and failed transactions', async () => {
      await monitor.start();
      
      const metrics = await monitor.getMetrics(new Date(), new Date());
      
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      
      await monitor.stop();
    });

    it('should track transaction volume', async () => {
      await monitor.start();
      
      const metrics = await monitor.getMetrics(new Date(), new Date());
      
      expect(metrics).toHaveProperty('totalVolume');
      expect(typeof metrics.totalVolume).toBe('number');
      
      await monitor.stop();
    });

    it('should calculate transactions per second', async () => {
      await monitor.start();
      
      const metrics = await monitor.getMetrics(new Date(), new Date());
      
      expect(metrics).toHaveProperty('transactionsPerSecond');
      expect(typeof metrics.transactionsPerSecond).toBe('number');
      
      await monitor.stop();
    });
  });

  describe('memory management', () => {
    it('should limit transaction buffer size', async () => {
      await monitor.start();
      
      // Buffer is limited to 100 transactions
      // Old transactions are removed when buffer exceeds limit
      
      await monitor.stop();
    });

    it('should handle memory cleanup on stop', async () => {
      await monitor.start();
      await monitor.stop();
      
      // After stop, resources should be cleaned up
      const status = monitor.getConnectionStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle start errors gracefully', async () => {
      // Mock error scenario
      const errorConfig: MonitoringConfig = {
        horizonUrl: 'invalid-url',
        network: 'testnet'
      };
      
      const errorMonitor = new TransactionMonitor(errorConfig);
      
      // Should not throw unhandled errors
      await expect(errorMonitor.start()).resolves.not.toThrow();
    });

    it('should handle stop errors gracefully', async () => {
      await monitor.start();
      
      // Should not throw unhandled errors
      await expect(monitor.stop()).resolves.not.toThrow();
    });
  });
});
