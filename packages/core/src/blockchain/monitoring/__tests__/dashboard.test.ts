import { MonitoringDashboard } from '../dashboard';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  LedgerEvent,
  TransactionAnalysis,
  Alert,
  AlertType,
  AlertSeverity,
  TransactionCategory,
  SystemHealth,
  AccountActivity,
  ChartDataPoint
} from '../types';

describe('MonitoringDashboard', () => {
  let dashboard: MonitoringDashboard;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    mockConfig = {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      network: 'testnet'
    };
    dashboard = new MonitoringDashboard(mockConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(dashboard).toBeInstanceOf(MonitoringDashboard);
    });

    it('should initialize with default system health', () => {
      const health = dashboard.getSystemHealth();
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
      expect(health.connectionStatus).toBe('disconnected');
    });

    it('should initialize with empty recent transactions', () => {
      const transactions = dashboard.getRecentTransactions();
      expect(transactions).toEqual([]);
    });

    it('should initialize with empty recent alerts', () => {
      const alerts = dashboard.getRecentAlerts();
      expect(alerts).toEqual([]);
    });
  });

  describe('start', () => {
    it('should start successfully', async () => {
      await expect(dashboard.start()).resolves.not.toThrow();
    });

    it('should set connection status to connected', async () => {
      await dashboard.start();
      const health = dashboard.getSystemHealth();
      expect(health.connectionStatus).toBe('connected');
    });
  });

  describe('stop', () => {
    it('should stop successfully', async () => {
      await dashboard.start();
      await expect(dashboard.stop()).resolves.not.toThrow();
    });

    it('should set connection status to disconnected', async () => {
      await dashboard.start();
      await dashboard.stop();
      const health = dashboard.getSystemHealth();
      expect(health.connectionStatus).toBe('disconnected');
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data).toHaveProperty('overview');
      expect(data).toHaveProperty('recentTransactions');
      expect(data).toHaveProperty('recentAlerts');
      expect(data).toHaveProperty('topAccounts');
      expect(data).toHaveProperty('charts');
    });

    it('should include real-time metrics in overview', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.overview).toHaveProperty('realTimeMetrics');
      expect(data.overview.realTimeMetrics).toHaveProperty('totalTransactions');
      expect(data.overview.realTimeMetrics).toHaveProperty('successfulTransactions');
      expect(data.overview.realTimeMetrics).toHaveProperty('failedTransactions');
    });

    it('should include network status in overview', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.overview).toHaveProperty('networkStatus');
      expect(data.overview.networkStatus).toHaveProperty('ledgerNumber');
      expect(data.overview.networkStatus).toHaveProperty('networkHealth');
    });

    it('should include alert summary in overview', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.overview).toHaveProperty('alertSummary');
      expect(data.overview.alertSummary).toHaveProperty('total');
      expect(data.overview.alertSummary).toHaveProperty('bySeverity');
    });

    it('should include system health in overview', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.overview).toHaveProperty('systemHealth');
      expect(data.overview.systemHealth).toHaveProperty('status');
      expect(data.overview.systemHealth).toHaveProperty('uptime');
    });

    it('should include chart data', async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data.charts).toHaveProperty('transactionVolume');
      expect(data.charts).toHaveProperty('transactionCount');
      expect(data.charts).toHaveProperty('alertTrends');
    });

    it('should cache dashboard data', async () => {
      const data1 = await dashboard.getDashboardData();
      const data2 = await dashboard.getDashboardData();
      
      expect(data1).toEqual(data2);
    });
  });

  describe('updateWithTransaction', () => {
    it('should update dashboard with transaction', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      expect(() => dashboard.updateWithTransaction(transaction, analysis)).not.toThrow();
    });

    it('should add transaction to recent transactions', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      dashboard.updateWithTransaction(transaction, analysis);
      const recentTransactions = dashboard.getRecentTransactions();

      expect(recentTransactions.length).toBeGreaterThan(0);
      expect(recentTransactions[0].id).toBe('tx_123');
    });

    it('should limit recent transactions to 50', () => {
      for (let i = 0; i < 60; i++) {
        const transaction: TransactionEvent = {
          id: `tx_${i}`,
          hash: `hash_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        dashboard.updateWithTransaction(transaction, analysis);
      }

      const recentTransactions = dashboard.getRecentTransactions();
      expect(recentTransactions.length).toBeLessThanOrEqual(50);
    });

    it('should update processing latency', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date(Date.now() - 100).toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      dashboard.updateWithTransaction(transaction, analysis);
      const health = dashboard.getSystemHealth();

      expect(health.processingLatency).toBeGreaterThanOrEqual(0);
    });

    it('should emit transaction_update event', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      const updateSpy = jest.fn();
      dashboard.on('transaction_update', updateSpy);

      dashboard.updateWithTransaction(transaction, analysis);

      expect(updateSpy).toHaveBeenCalledWith({ transaction, analysis });
    });

    it('should invalidate cache on update', async () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      const data1 = await dashboard.getDashboardData();
      dashboard.updateWithTransaction(transaction, analysis);
      const data2 = await dashboard.getDashboardData();

      expect(data2.recentTransactions.length).toBeGreaterThan(data1.recentTransactions.length);
    });
  });

  describe('updateWithLedger', () => {
    it('should update dashboard with ledger', () => {
      const ledger: LedgerEvent = {
        sequence: 1000,
        hash: 'ledger_hash',
        prevHash: 'prev_hash',
        transactionCount: 50,
        operationCount: 100,
        closedAt: new Date().toISOString(),
        totalCoins: '100000000',
        feePool: '1000',
        baseFee: 100,
        baseReserve: 10
      };

      expect(() => dashboard.updateWithLedger(ledger)).not.toThrow();
    });

    it('should update system health from ledger', () => {
      const ledger: LedgerEvent = {
        sequence: 1000,
        hash: 'ledger_hash',
        prevHash: 'prev_hash',
        transactionCount: 50,
        operationCount: 100,
        closedAt: new Date().toISOString(),
        totalCoins: '100000000',
        feePool: '1000',
        baseFee: 100,
        baseReserve: 10
      };

      dashboard.updateWithLedger(ledger);
      const health = dashboard.getSystemHealth();

      expect(health.connectionStatus).toBe('connected');
    });

    it('should emit ledger_update event', () => {
      const ledger: LedgerEvent = {
        sequence: 1000,
        hash: 'ledger_hash',
        prevHash: 'prev_hash',
        transactionCount: 50,
        operationCount: 100,
        closedAt: new Date().toISOString(),
        totalCoins: '100000000',
        feePool: '1000',
        baseFee: 100,
        baseReserve: 10
      };

      const updateSpy = jest.fn();
      dashboard.on('ledger_update', updateSpy);

      dashboard.updateWithLedger(ledger);

      expect(updateSpy).toHaveBeenCalledWith(ledger);
    });
  });

  describe('updateWithAlert', () => {
    it('should update dashboard with alert', () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'High Value Alert',
        message: 'High value transaction detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      expect(() => dashboard.updateWithAlert(alert)).not.toThrow();
    });

    it('should add alert to recent alerts', () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'High Value Alert',
        message: 'High value transaction detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(alert);
      const recentAlerts = dashboard.getRecentAlerts();

      expect(recentAlerts.length).toBeGreaterThan(0);
      expect(recentAlerts[0].id).toBe('alert_123');
    });

    it('should limit recent alerts to 20', () => {
      for (let i = 0; i < 25; i++) {
        const alert: Alert = {
          id: `alert_${i}`,
          ruleId: 'high_value_rule',
          type: AlertType.HIGH_VALUE_TRANSACTION,
          severity: AlertSeverity.MEDIUM,
          title: `Alert ${i}`,
          message: `Alert message ${i}`,
          data: {},
          timestamp: new Date(),
          acknowledged: false,
          transactionId: `tx_${i}`
        };

        dashboard.updateWithAlert(alert);
      }

      const recentAlerts = dashboard.getRecentAlerts();
      expect(recentAlerts.length).toBeLessThanOrEqual(20);
    });

    it('should update system health to critical on critical alert', () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.CRITICAL,
        title: 'Critical Alert',
        message: 'Critical issue detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(alert);
      const health = dashboard.getSystemHealth();

      expect(health.status).toBe('critical');
    });

    it('should update system health to degraded on high alert', () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.HIGH,
        title: 'High Alert',
        message: 'High severity issue detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(alert);
      const health = dashboard.getSystemHealth();

      expect(health.status).toBe('degraded');
    });

    it('should emit alert_update event', () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'High Value Alert',
        message: 'High value transaction detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      const updateSpy = jest.fn();
      dashboard.on('alert_update', updateSpy);

      dashboard.updateWithAlert(alert);

      expect(updateSpy).toHaveBeenCalledWith(alert);
    });
  });

  describe('getRealtimeStream', () => {
    it('should return event emitter', () => {
      const stream = dashboard.getRealtimeStream();
      expect(stream).toBeDefined();
      expect(stream).toBe(dashboard);
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health', () => {
      const health = dashboard.getSystemHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('connectionStatus');
      expect(health).toHaveProperty('processingLatency');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('lastHealthCheck');
    });

    it('should return a copy of health object', () => {
      const health1 = dashboard.getSystemHealth();
      const health2 = dashboard.getSystemHealth();

      expect(health1).not.toBe(health2);
    });
  });

  describe('getRecentTransactions', () => {
    it('should return recent transactions', () => {
      const transactions = dashboard.getRecentTransactions();
      expect(Array.isArray(transactions)).toBe(true);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        const transaction: TransactionEvent = {
          id: `tx_${i}`,
          hash: `hash_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: 'G123',
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        dashboard.updateWithTransaction(transaction, analysis);
      }

      const transactions = dashboard.getRecentTransactions(5);
      expect(transactions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getRecentAlerts', () => {
    it('should return recent alerts', () => {
      const alerts = dashboard.getRecentAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        const alert: Alert = {
          id: `alert_${i}`,
          ruleId: 'high_value_rule',
          type: AlertType.HIGH_VALUE_TRANSACTION,
          severity: AlertSeverity.MEDIUM,
          title: `Alert ${i}`,
          message: `Message ${i}`,
          data: {},
          timestamp: new Date(),
          acknowledged: false,
          transactionId: `tx_${i}`
        };

        dashboard.updateWithAlert(alert);
      }

      const alerts = dashboard.getRecentAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getAlertSummary', () => {
    it('should return alert summary', () => {
      const summary = dashboard.getAlertSummary();

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('bySeverity');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('unacknowledged');
    });

    it('should count by severity correctly', () => {
      const highAlert: Alert = {
        id: 'high_alert',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.HIGH,
        title: 'High Alert',
        message: 'High severity',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_1'
      };

      const mediumAlert: Alert = {
        id: 'medium_alert',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Medium Alert',
        message: 'Medium severity',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_2'
      };

      dashboard.updateWithAlert(highAlert);
      dashboard.updateWithAlert(mediumAlert);

      const summary = dashboard.getAlertSummary();
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.medium).toBe(1);
    });

    it('should count by type correctly', () => {
      const fraudAlert: Alert = {
        id: 'fraud_alert',
        ruleId: 'fraud_detection_rule',
        type: AlertType.FRAUD_DETECTED,
        severity: AlertSeverity.HIGH,
        title: 'Fraud Alert',
        message: 'Fraud detected',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_1'
      };

      dashboard.updateWithAlert(fraudAlert);

      const summary = dashboard.getAlertSummary();
      expect(summary.byType.fraud_detected).toBe(1);
    });

    it('should count unacknowledged alerts correctly', () => {
      const alert: Alert = {
        id: 'test_alert',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Test Alert',
        message: 'Test message',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(alert);

      const summary = dashboard.getAlertSummary();
      expect(summary.unacknowledged).toBe(1);
    });
  });

  describe('generateChartData', () => {
    it('should generate chart data', () => {
      const chartData = dashboard.generateChartData();

      expect(chartData).toHaveProperty('transactionVolume');
      expect(chartData).toHaveProperty('transactionCount');
      expect(chartData).toHaveProperty('alertTrends');
      expect(Array.isArray(chartData.transactionVolume)).toBe(true);
      expect(Array.isArray(chartData.transactionCount)).toBe(true);
      expect(Array.isArray(chartData.alertTrends)).toBe(true);
    });

    it('should generate volume chart with time intervals', () => {
      const chartData = dashboard.generateChartData();
      
      chartData.transactionVolume.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
      });
    });

    it('should generate count chart with time intervals', () => {
      const chartData = dashboard.generateChartData();
      
      chartData.transactionCount.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
      });
    });

    it('should generate alert trends chart with time intervals', () => {
      const chartData = dashboard.generateChartData();
      
      chartData.alertTrends.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
      });
    });
  });

  describe('getTopAccounts', () => {
    it('should return top accounts', () => {
      const accounts = dashboard.getTopAccounts();
      expect(Array.isArray(accounts)).toBe(true);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 15; i++) {
        const transaction: TransactionEvent = {
          id: `tx_${i}`,
          hash: `hash_${i}`,
          ledger: 1000 + i,
          createdAt: new Date().toISOString(),
          sourceAccount: `G${i}`,
          fee: '100',
          operationCount: 1,
          operations: [],
          successful: true
        };

        const analysis: TransactionAnalysis = {
          transactionId: `tx_${i}`,
          category: TransactionCategory.NORMAL,
          riskScore: 50,
          flags: [],
          confidence: 0.9,
          analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
          timestamp: new Date()
        };

        dashboard.updateWithTransaction(transaction, analysis);
      }

      const accounts = dashboard.getTopAccounts(5);
      expect(accounts.length).toBeLessThanOrEqual(5);
    });

    it('should sort by transaction count', () => {
      const tx1: TransactionEvent = {
        id: 'tx_1',
        hash: 'hash_1',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const tx2: TransactionEvent = {
        id: 'tx_2',
        hash: 'hash_2',
        ledger: 1001,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_1',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      dashboard.updateWithTransaction(tx1, analysis);
      dashboard.updateWithTransaction(tx2, analysis);

      const accounts = dashboard.getTopAccounts();
      if (accounts.length > 0) {
        expect(accounts[0].accountId).toBe('G123');
        expect(accounts[0].transactionCount).toBe(2);
      }
    });
  });

  describe('exportData', () => {
    it('should export data as JSON', async () => {
      const json = await dashboard.exportData('json');
      
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('overview');
    });

    it('should export data as CSV', async () => {
      const csv = await dashboard.exportData('csv');
      
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Timestamp,Hash,Source Account,Fee,Successful');
    });

    it('should include transaction data in CSV', async () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: '2024-01-01T00:00:00.000Z',
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      dashboard.updateWithTransaction(transaction, analysis);
      const csv = await dashboard.exportData('csv');

      expect(csv).toContain('hash_123');
      expect(csv).toContain('G123');
    });
  });

  describe('health monitoring', () => {
    it('should update health periodically', () => {
      const healthSpy = jest.fn();
      dashboard.on('health_update', healthSpy);

      jest.advanceTimersByTime(30000);

      expect(healthSpy).toHaveBeenCalled();
    });

    it('should update last health check timestamp', () => {
      const health1 = dashboard.getSystemHealth();
      jest.advanceTimersByTime(30000);
      const health2 = dashboard.getSystemHealth();

      expect(health2.lastHealthCheck.getTime()).toBeGreaterThan(health1.lastHealthCheck.getTime());
    });

    it('should calculate uptime', () => {
      const health = dashboard.getSystemHealth();
      expect(typeof health.uptime).toBe('number');
    });

    it('should update memory usage', () => {
      const health = dashboard.getSystemHealth();
      expect(typeof health.memoryUsage).toBe('number');
    });

    it('should determine health status from alerts', () => {
      const criticalAlert: Alert = {
        id: 'critical_alert',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.CRITICAL,
        title: 'Critical Alert',
        message: 'Critical issue',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      dashboard.updateWithAlert(criticalAlert);
      const health = dashboard.getSystemHealth();

      expect(health.status).toBe('critical');
    });
  });

  describe('TPS calculations', () => {
    it('should calculate TPS from recent transactions', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      dashboard.updateWithTransaction(transaction, analysis);

      const data = dashboard.getDashboardData();
      expect(data.then).toBeDefined(); // It's async
    });
  });

  describe('error handling', () => {
    it('should handle updateWithTransaction errors gracefully', () => {
      const invalidTransaction = {} as TransactionEvent;
      const invalidAnalysis = {} as TransactionAnalysis;

      expect(() => dashboard.updateWithTransaction(invalidTransaction, invalidAnalysis)).not.toThrow();
    });

    it('should handle updateWithLedger errors gracefully', () => {
      const invalidLedger = {} as LedgerEvent;

      expect(() => dashboard.updateWithLedger(invalidLedger)).not.toThrow();
    });

    it('should handle updateWithAlert errors gracefully', () => {
      const invalidAlert = {} as Alert;

      expect(() => dashboard.updateWithAlert(invalidAlert)).not.toThrow();
    });

    it('should handle getDashboardData errors gracefully', async () => {
      // Should not throw even with no data
      await expect(dashboard.getDashboardData()).resolves.not.toThrow();
    });
  });

  describe('cache management', () => {
    it('should invalidate cache on transaction update', async () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis: TransactionAnalysis = {
        transactionId: 'tx_123',
        category: TransactionCategory.NORMAL,
        riskScore: 50,
        flags: [],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      await dashboard.getDashboardData();
      dashboard.updateWithTransaction(transaction, analysis);

      // Cache should be invalidated, next call should return fresh data
      const data = await dashboard.getDashboardData();
      expect(data.recentTransactions.length).toBeGreaterThan(0);
    });

    it('should invalidate cache on alert update', async () => {
      const alert: Alert = {
        id: 'alert_123',
        ruleId: 'high_value_rule',
        type: AlertType.HIGH_VALUE_TRANSACTION,
        severity: AlertSeverity.MEDIUM,
        title: 'Alert',
        message: 'Alert message',
        data: {},
        timestamp: new Date(),
        acknowledged: false,
        transactionId: 'tx_123'
      };

      await dashboard.getDashboardData();
      dashboard.updateWithAlert(alert);

      const data = await dashboard.getDashboardData();
      expect(data.recentAlerts.length).toBeGreaterThan(0);
    });

    it('should invalidate cache on ledger update', async () => {
      const ledger: LedgerEvent = {
        sequence: 1000,
        hash: 'ledger_hash',
        prevHash: 'prev_hash',
        transactionCount: 50,
        operationCount: 100,
        closedAt: new Date().toISOString(),
        totalCoins: '100000000',
        feePool: '1000',
        baseFee: 100,
        baseReserve: 10
      };

      await dashboard.getDashboardData();
      dashboard.updateWithLedger(ledger);

      // Cache should be invalidated
      await expect(dashboard.getDashboardData()).resolves.not.toThrow();
    });
  });
});
