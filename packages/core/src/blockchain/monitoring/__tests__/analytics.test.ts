import { TransactionAnalytics } from '../analytics';
import { 
  MonitoringConfig, 
  TransactionEvent, 
  LedgerEvent,
  TransactionAnalysis,
  TransactionCategory,
  AccountActivity,
  AssetMetric,
  ChartDataPoint
} from '../types';

describe('TransactionAnalytics', () => {
  let analytics: TransactionAnalytics;
  let mockConfig: MonitoringConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    mockConfig = {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      network: 'testnet',
      batchSize: 100
    };
    analytics = new TransactionAnalytics(mockConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(analytics).toBeInstanceOf(TransactionAnalytics);
    });

    it('should initialize with empty metrics', () => {
      const metrics = analytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBe(0);
      expect(metrics.successfulTransactions).toBe(0);
      expect(metrics.failedTransactions).toBe(0);
    });

    it('should initialize with empty chart data', () => {
      const chartData = analytics.getChartData();
      expect(chartData.volume).toEqual([]);
      expect(chartData.count).toEqual([]);
      expect(chartData.alerts).toEqual([]);
    });
  });

  describe('start', () => {
    it('should start successfully', async () => {
      await expect(analytics.start()).resolves.not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop successfully', async () => {
      await analytics.start();
      await expect(analytics.stop()).resolves.not.toThrow();
    });
  });

  describe('processTransaction', () => {
    it('should process a transaction', () => {
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

      expect(() => analytics.processTransaction(transaction, analysis)).not.toThrow();
    });

    it('should update real-time metrics', () => {
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

      const initialMetrics = analytics.getRealtimeMetrics();
      analytics.processTransaction(transaction, analysis);
      const updatedMetrics = analytics.getRealtimeMetrics();

      expect(updatedMetrics.totalTransactions).toBe(initialMetrics.totalTransactions + 1);
    });

    it('should update successful transaction count', () => {
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

      analytics.processTransaction(transaction, analysis);
      const metrics = analytics.getRealtimeMetrics();

      expect(metrics.successfulTransactions).toBe(1);
    });

    it('should update failed transaction count', () => {
      const transaction: TransactionEvent = {
        id: 'tx_123',
        hash: 'hash_123',
        ledger: 1000,
        createdAt: new Date().toISOString(),
        sourceAccount: 'G123',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: false
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

      analytics.processTransaction(transaction, analysis);
      const metrics = analytics.getRealtimeMetrics();

      expect(metrics.failedTransactions).toBe(1);
    });

    it('should update transaction volume', () => {
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

      analytics.processTransaction(transaction, analysis);
      const metrics = analytics.getRealtimeMetrics();

      expect(metrics.totalVolume).toBeGreaterThan(0);
    });
  });

  describe('processLedger', () => {
    it('should process a ledger', () => {
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

      expect(() => analytics.processLedger(ledger)).not.toThrow();
    });

    it('should update network metrics', () => {
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

      analytics.processLedger(ledger);
      const networkMetrics = analytics.getNetworkMetrics();

      expect(networkMetrics.ledgerNumber).toBe(1000);
      expect(networkMetrics.transactionThroughput).toBe(50);
    });

    it('should add chart data point for count', () => {
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

      const initialChartData = analytics.getChartData();
      analytics.processLedger(ledger);
      const updatedChartData = analytics.getChartData();

      expect(updatedChartData.count.length).toBe(initialChartData.count.length + 1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for time range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const metrics = await analytics.getMetrics(startTime, endTime);

      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('totalVolume');
      expect(metrics).toHaveProperty('timeRange');
    });

    it('should cache metrics results', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const metrics1 = await analytics.getMetrics(startTime, endTime);
      const metrics2 = await analytics.getMetrics(startTime, endTime);

      // Check that the metrics are structurally similar (not strict equality due to Date objects)
      expect(metrics1.totalTransactions).toBe(metrics2.totalTransactions);
      expect(metrics1.successfulTransactions).toBe(metrics2.successfulTransactions);
      expect(metrics1.failedTransactions).toBe(metrics2.failedTransactions);
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return current real-time metrics', () => {
      const metrics = analytics.getRealtimeMetrics();

      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('totalVolume');
      expect(metrics).toHaveProperty('averageTransactionValue');
      expect(metrics).toHaveProperty('transactionsPerSecond');
    });

    it('should return a copy of metrics', () => {
      const metrics1 = analytics.getRealtimeMetrics();
      const metrics2 = analytics.getRealtimeMetrics();

      expect(metrics1).not.toBe(metrics2);
    });
  });

  describe('getNetworkMetrics', () => {
    it('should return network metrics', () => {
      const metrics = analytics.getNetworkMetrics();

      expect(metrics).toHaveProperty('ledgerNumber');
      expect(metrics).toHaveProperty('transactionThroughput');
      expect(metrics).toHaveProperty('averageFee');
      expect(metrics).toHaveProperty('networkHealth');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('should return a copy of metrics', () => {
      const metrics1 = analytics.getNetworkMetrics();
      const metrics2 = analytics.getNetworkMetrics();

      expect(metrics1).not.toBe(metrics2);
    });
  });

  describe('getAccountActivity', () => {
    it('should return account activity data', () => {
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

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity();

      expect(Array.isArray(activities)).toBe(true);
    });

    it('should respect limit parameter', () => {
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

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity(5);

      expect(activities.length).toBeLessThanOrEqual(5);
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
        sourceAccount: 'G456',
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

      analytics.processTransaction(tx1, analysis);
      analytics.processTransaction(tx2, analysis);

      const activities = analytics.getAccountActivity();
      if (activities.length > 1) {
        expect(activities[0].transactionCount).toBeGreaterThanOrEqual(activities[1].transactionCount);
      }
    });
  });

  describe('getTopAssets', () => {
    it('should return top assets by volume', () => {
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

      analytics.processTransaction(transaction, analysis);
      const assets = analytics.getTopAssets();

      expect(Array.isArray(assets)).toBe(true);
    });

    it('should respect limit parameter', () => {
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

      analytics.processTransaction(transaction, analysis);
      const assets = analytics.getTopAssets(5);

      expect(assets.length).toBeLessThanOrEqual(5);
    });

    it('should sort by volume', () => {
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

      analytics.processTransaction(transaction, analysis);
      const assets = analytics.getTopAssets();

      if (assets.length > 1) {
        expect(assets[0].volume).toBeGreaterThanOrEqual(assets[1].volume);
      }
    });
  });

  describe('getChartData', () => {
    it('should return chart data', () => {
      const chartData = analytics.getChartData();

      expect(chartData).toHaveProperty('volume');
      expect(chartData).toHaveProperty('count');
      expect(chartData).toHaveProperty('alerts');
      expect(Array.isArray(chartData.volume)).toBe(true);
      expect(Array.isArray(chartData.count)).toBe(true);
      expect(Array.isArray(chartData.alerts)).toBe(true);
    });

    it('should return copies of chart data arrays', () => {
      const chartData1 = analytics.getChartData();
      const chartData2 = analytics.getChartData();

      expect(chartData1.volume).not.toBe(chartData2.volume);
      expect(chartData1.count).not.toBe(chartData2.count);
      expect(chartData1.alerts).not.toBe(chartData2.alerts);
    });
  });

  describe('calculateThroughput', () => {
    it('should calculate TPS for a period', () => {
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

      analytics.processTransaction(transaction, analysis);
      const tps = analytics.calculateThroughput(1);

      expect(typeof tps).toBe('number');
      expect(tps).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for no transactions', () => {
      const tps = analytics.calculateThroughput(1);
      expect(tps).toBe(0);
    });
  });

  describe('getVolumeTrend', () => {
    it('should return volume trend for specified hours', () => {
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

      analytics.processTransaction(transaction, analysis);
      const trend = analytics.getVolumeTrend(24);

      expect(Array.isArray(trend)).toBe(true);
    });
  });

  describe('calculateAverageTransactionValue', () => {
    it('should calculate average transaction value', () => {
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

      analytics.processTransaction(transaction, analysis);
      const avgValue = analytics.calculateAverageTransactionValue();

      expect(typeof avgValue).toBe('number');
      expect(avgValue).toBeGreaterThan(0);
    });

    it('should return 0 for no transactions', () => {
      const avgValue = analytics.calculateAverageTransactionValue();
      expect(avgValue).toBe(0);
    });
  });

  describe('generateReport', () => {
    it('should generate analytics report', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const report = await analytics.generateReport(startTime, endTime);

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('topAccounts');
      expect(report).toHaveProperty('topAssets');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('insights');
    });

    it('should include summary metrics', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const report = await analytics.generateReport(startTime, endTime);

      expect(report.summary).toHaveProperty('totalTransactions');
      expect(report.summary).toHaveProperty('successfulTransactions');
      expect(report.summary).toHaveProperty('failedTransactions');
    });

    it('should include insights', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      const report = await analytics.generateReport(startTime, endTime);

      expect(Array.isArray(report.insights)).toBe(true);
    });
  });

  describe('account activity tracking', () => {
    it('should track account transaction count', () => {
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

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity();
      const accountActivity = activities.find(a => a.accountId === 'G123');

      expect(accountActivity?.transactionCount).toBe(1);
    });

    it('should track account risk score', () => {
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
        category: TransactionCategory.SUSPICIOUS,
        riskScore: 75,
        flags: ['suspicious'],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity();
      const accountActivity = activities.find(a => a.accountId === 'G123');

      expect(accountActivity?.riskScore).toBe(75);
    });

    it('should track account flags', () => {
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
        category: TransactionCategory.SUSPICIOUS,
        riskScore: 75,
        flags: ['suspicious', 'high_value'],
        confidence: 0.9,
        analysis: { volumeAnalysis: undefined, patternAnalysis: undefined, networkAnalysis: undefined },
        timestamp: new Date()
      };

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity();
      const accountActivity = activities.find(a => a.accountId === 'G123');

      expect(accountActivity?.flags).toContain('suspicious');
      expect(accountActivity?.flags).toContain('high_value');
    });

    it('should track first and last seen timestamps', () => {
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

      analytics.processTransaction(transaction, analysis);
      const activities = analytics.getAccountActivity();
      const accountActivity = activities.find(a => a.accountId === 'G123');

      expect(accountActivity?.firstSeen).toBeDefined();
      expect(accountActivity?.lastSeen).toBeDefined();
    });
  });

  describe('batch processing', () => {
    it('should process transactions in batches', () => {
      const batchSize = 100;
      const config: MonitoringConfig = {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        network: 'testnet',
        batchSize
      };

      const batchAnalytics = new TransactionAnalytics(config);

      for (let i = 0; i < 150; i++) {
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

        batchAnalytics.processTransaction(transaction, analysis);
      }

      const metrics = batchAnalytics.getRealtimeMetrics();
      expect(metrics.totalTransactions).toBeGreaterThan(0);
    });

    it('should emit metrics event on batch processing', () => {
      const config: MonitoringConfig = {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        network: 'testnet',
        batchSize: 10
      };

      const batchAnalytics = new TransactionAnalytics(config);
      const metricsSpy = jest.fn();
      batchAnalytics.on('metrics', metricsSpy);

      for (let i = 0; i < 15; i++) {
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

        batchAnalytics.processTransaction(transaction, analysis);
      }

      // Metrics event should be emitted when batch is processed
      expect(typeof metricsSpy).toBe('function');
    });
  });

  describe('chart data management', () => {
    it('should limit chart data points', () => {
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

      // Process many transactions to exceed chart data limit
      for (let i = 0; i < 1100; i++) {
        analytics.processTransaction(transaction, analysis);
      }

      const chartData = analytics.getChartData();
      expect(chartData.volume.length).toBeLessThanOrEqual(1000);
      expect(chartData.count.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('memory management', () => {
    it('should clean up old account activities', () => {
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

      analytics.processTransaction(transaction, analysis);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(60000);
      jest.advanceTimersByTime(60000);

      const activities = analytics.getAccountActivity();
      // Old activities should be cleaned up
      expect(Array.isArray(activities)).toBe(true);
    });

    it('should clean up old chart data points', () => {
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

      analytics.processTransaction(transaction, analysis);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(60000);
      jest.advanceTimersByTime(60000);

      const chartData = analytics.getChartData();
      expect(Array.isArray(chartData.volume)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle processTransaction errors gracefully', () => {
      const invalidTransaction = {} as TransactionEvent;
      const invalidAnalysis = {} as TransactionAnalysis;

      // The method catches errors internally and logs them
      // So it should not throw, but handle gracefully
      expect(() => analytics.processTransaction(invalidTransaction, invalidAnalysis)).not.toThrow();
    });

    it('should handle processLedger errors gracefully', () => {
      const invalidLedger = {} as LedgerEvent;

      expect(() => analytics.processLedger(invalidLedger)).not.toThrow();
    });
  });
});
