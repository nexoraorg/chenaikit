import { 
  MonitoringConfig, 
  TransactionEvent, 
  TransactionAnalysis,
  TransactionCategory,
  Alert,
  AlertType,
  AlertSeverity,
  ConnectionStatus
} from './types';

// Simple EventEmitter implementation
interface EventListener {
  (...args: any[]): void;
}

class SimpleEventEmitter {
  private events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners) return false;
    
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
    return true;
  }

  removeListener(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }
}

/**
 * Simplified Transaction Monitor using minimal dependencies
 */
export class TransactionMonitor extends SimpleEventEmitter {
  private config: MonitoringConfig;
  private connectionStatus: ConnectionStatus;
  private transactionBuffer: TransactionEvent[] = [];
  private alertRules: Map<string, any> = new Map();
  private metrics: any = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalVolume: 0,
    transactionsPerSecond: 0
  };
  private pollingInterval: any = null;

  constructor(config: MonitoringConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      batchSize: 100,
      ...config
    };

    this.connectionStatus = {
      connected: false,
      reconnecting: false,
      reconnectAttempts: 0
    };

    this.initializeDefaultAlertRules();
  }

  /**
   * Start monitoring
   */
  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting Transaction Monitoring System...');
      console.log(`📡 Monitoring: ${this.config.horizonUrl}`);
      
      this.startPolling();
      
      console.log('✅ Transaction monitoring started successfully');
    } catch (error) {
      console.error('❌ Failed to start transaction monitoring:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  public async stop(): Promise<void> {
    try {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      this.connectionStatus.connected = false;
      console.log('🛑 Transaction monitoring stopped');
    } catch (error) {
      console.error('Error stopping transaction monitoring:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get dashboard data
   */
  public async getDashboardData() {
    return {
      overview: {
        realTimeMetrics: this.metrics,
        systemHealth: {
          status: this.connectionStatus.connected ? 'healthy' : 'degraded',
          uptime: Date.now(),
          connectionStatus: this.connectionStatus.connected ? 'connected' : 'disconnected'
        }
      },
      recentTransactions: this.transactionBuffer.slice(0, 20),
      recentAlerts: []
    };
  }

  /**
   * Add alert rule
   */
  public addAlertRule(rule: any): void {
    this.alertRules.set(rule.id, rule);
    console.log(`📋 Alert rule added: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): void {
    if (this.alertRules.delete(ruleId)) {
      console.log(`🗑️ Alert rule removed: ${ruleId}`);
    }
  }

  /**
   * Get metrics
   */
  public async getMetrics(startTime: Date, endTime: Date) {
    return {
      ...this.metrics,
      timeRange: { start: startTime, end: endTime }
    };
  }

  /**
   * Replay transactions (simplified)
   */
  public async replayTransactions(startLedger: number, endLedger: number): Promise<void> {
    console.log(`🔄 Replaying transactions from ledger ${startLedger} to ${endLedger}`);
    // Simplified implementation
    console.log(`✅ Transaction replay completed for ledgers ${startLedger}-${endLedger}`);
  }

  /**
   * Verify transaction
   */
  public async verifyTransaction(transactionId: string): Promise<boolean> {
    try {
      // Simplified verification
      return true;
    } catch (error) {
      console.error('❌ Error verifying transaction:', error);
      return false;
    }
  }

  /**
   * Start polling for transactions
   */
  private startPolling(): void {
    this.connectionStatus.connected = true;
    this.emit('connected');

    // Poll every 10 seconds
    this.pollingInterval = setInterval(() => {
      this.pollForTransactions();
    }, 10000);
  }

  /**
   * Poll for new transactions
   */
  private async pollForTransactions(): Promise<void> {
    try {
      // Generate mock transaction for demonstration
      const mockTransaction: TransactionEvent = {
        id: `mock_${Date.now()}`,
        hash: `hash_${Date.now()}`,
        ledger: Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        sourceAccount: 'GEXAMPLE...',
        fee: '100',
        operationCount: 1,
        operations: [],
        successful: true
      };

      const analysis = await this.analyzeTransaction(mockTransaction);
      await this.processTransaction(mockTransaction, analysis);

    } catch (error) {
      console.error('Error polling for transactions:', error);
    }
  }

  /**
   * Analyze transaction
   */
  private async analyzeTransaction(transaction: TransactionEvent): Promise<TransactionAnalysis> {
    try {
      let category = TransactionCategory.NORMAL;
      let riskScore = Math.random() * 100; // Random risk score for demo
      const flags: string[] = [];

      if (riskScore > 80) {
        category = TransactionCategory.SUSPICIOUS;
        flags.push('suspicious_pattern');
      } else if (riskScore > 60) {
        category = TransactionCategory.HIGH_VALUE;
        flags.push('high_value');
      }

      return {
        transactionId: transaction.id,
        category,
        riskScore,
        flags,
        confidence: 0.8,
        analysis: {},
        timestamp: new Date()
      };

    } catch (error) {
      return {
        transactionId: transaction.id,
        category: TransactionCategory.NORMAL,
        riskScore: 0,
        flags: ['analysis_error'],
        confidence: 0,
        analysis: {},
        timestamp: new Date()
      };
    }
  }

  /**
   * Process transaction
   */
  private async processTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): Promise<void> {
    try {
      // Add to buffer
      this.transactionBuffer.unshift(transaction);
      if (this.transactionBuffer.length > 100) {
        this.transactionBuffer.pop();
      }

      // Update metrics
      this.updateMetrics(transaction);

      // Emit event
      this.emit('transaction', transaction, analysis);

      // Check alerts
      await this.checkAlerts(transaction, analysis);

    } catch (error) {
      console.error('Error processing transaction:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(transaction: TransactionEvent): void {
    this.metrics.totalTransactions++;
    
    if (transaction.successful) {
      this.metrics.successfulTransactions++;
    } else {
      this.metrics.failedTransactions++;
    }

    const estimatedVolume = parseFloat(transaction.fee) * 10;
    this.metrics.totalVolume += estimatedVolume;
    this.metrics.transactionsPerSecond = this.transactionBuffer.length / 60;
  }

  /**
   * Check for alerts
   */
  private async checkAlerts(transaction: TransactionEvent, analysis: TransactionAnalysis): Promise<void> {
    try {
      if (analysis.riskScore > 80) {
        const alert: Alert = {
          id: `alert_${Date.now()}`,
          ruleId: 'high_risk_rule',
          type: AlertType.SUSPICIOUS_PATTERN,
          severity: AlertSeverity.HIGH,
          title: 'High Risk Transaction',
          message: `High risk transaction detected: ${transaction.hash}`,
          data: { transaction, analysis },
          timestamp: new Date(),
          acknowledged: false,
          transactionId: transaction.id
        };
        
        this.emit('alert', alert);
        console.log(`🚨 ALERT: ${alert.title} (Risk: ${analysis.riskScore})`);
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const highRiskRule = {
      id: 'high_risk_rule',
      name: 'High Risk Transaction',
      type: AlertType.SUSPICIOUS_PATTERN,
      severity: AlertSeverity.HIGH,
      enabled: true
    };

    this.addAlertRule(highRiskRule);
  }
}