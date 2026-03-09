/**
 * WebSocket Testing Utilities
 * Provides tools for testing WebSocket connections and real-time monitoring
 */

import { TransactionMonitor } from '@chenaikit/core';
import { MonitoringConfig, TransactionEvent, TransactionAnalysis, Alert } from '@chenaikit/core';

export interface WebSocketTestConfig {
  url: string;
  testDuration: number; // in seconds
  transactionRate: number; // transactions per second
  enableAlerts: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class WebSocketTester {
  private monitor: TransactionMonitor;
  private config: WebSocketTestConfig;
  private metrics: {
    totalTransactions: number;
    totalAlerts: number;
    errors: number;
    startTime: number;
    latencies: number[];
  };

  constructor(config: WebSocketTestConfig) {
    this.config = config;
    this.metrics = {
      totalTransactions: 0,
      totalAlerts: 0,
      errors: 0,
      startTime: 0,
      latencies: []
    };
    
    const monitoringConfig: MonitoringConfig = {
      horizonUrl: config.url,
      network: 'testnet',
      reconnectInterval: 1000,
      maxReconnectAttempts: 5
    };
    
    this.monitor = new TransactionMonitor(monitoringConfig);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.monitor.on('connected', () => {
      this.log('info', '✅ WebSocket connected');
    });

    this.monitor.on('transaction', (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
      this.metrics.totalTransactions++;
      this.metrics.latencies.push(Date.now() - this.metrics.startTime);
      
      if (this.config.logLevel === 'debug') {
        this.log('debug', `📦 Transaction: ${transaction.hash} (Risk: ${analysis.riskScore.toFixed(1)})`);
      }
    });

    this.monitor.on('alert', (alert: Alert) => {
      this.metrics.totalAlerts++;
      this.log('warn', `🚨 Alert: ${alert.title} - ${alert.message}`);
    });

    this.monitor.on('error', (error: Error) => {
      this.metrics.errors++;
      this.log('error', `❌ Error: ${error.message}`);
    });

    this.monitor.on('disconnected', (reason: string) => {
      this.log('info', `🔌 Disconnected: ${reason}`);
    });
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }

  async runTest(): Promise<void> {
    this.log('info', '🧪 Starting WebSocket test...');
    this.metrics.startTime = Date.now();

    try {
      // Start monitoring
      await this.monitor.start();
      
      // Run for specified duration
      await this.waitForDuration(this.config.testDuration * 1000);
      
      // Stop monitoring
      await this.monitor.stop();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      this.log('error', `Test failed: ${error}`);
      throw error;
    }
  }

  private async waitForDuration(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateReport(): void {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    const avgLatency = this.metrics.latencies.length > 0 
      ? this.metrics.latencies.reduce((sum, lat) => sum + lat, 0) / this.metrics.latencies.length 
      : 0;
    
    const report = {
      testDuration: duration,
      totalTransactions: this.metrics.totalTransactions,
      transactionsPerSecond: this.metrics.totalTransactions / duration,
      totalAlerts: this.metrics.totalAlerts,
      totalErrors: this.metrics.errors,
      averageLatency: avgLatency,
      successRate: ((this.metrics.totalTransactions - this.metrics.errors) / Math.max(this.metrics.totalTransactions, 1)) * 100
    };

    this.log('info', '\n📊 === Test Report ===');
    this.log('info', `⏱️  Duration: ${duration.toFixed(2)}s`);
    this.log('info', `📦 Transactions: ${report.totalTransactions} (${report.transactionsPerSecond.toFixed(2)} tx/s)`);
    this.log('info', `🚨 Alerts: ${report.totalAlerts}`);
    this.log('info', `❌ Errors: ${report.totalErrors}`);
    this.log('info', `📈 Success Rate: ${report.successRate.toFixed(2)}%`);
    this.log('info', `⚡ Avg Latency: ${avgLatency.toFixed(2)}ms`);
    this.log('info', '==================\n');
  }

  async stressTest(concurrentConnections: number = 10): Promise<void> {
    this.log('info', `🔥 Starting stress test with ${concurrentConnections} concurrent connections...`);
    
    const connections: Promise<void>[] = [];
    
    for (let i = 0; i < concurrentConnections; i++) {
      const testConfig = { ...this.config };
      const tester = new WebSocketTester(testConfig);
      
      connections.push(
        tester.runTest().catch(error => {
          this.log('error', `Connection ${i} failed: ${error}`);
        })
      );
    }
    
    await Promise.all(connections);
    this.log('info', '🔥 Stress test completed');
  }

  async benchmark(): Promise<void> {
    this.log('info', '🏃 Running performance benchmark...');
    
    const benchmarks = [
      { name: 'Low Load', rate: 1, duration: 10 },
      { name: 'Medium Load', rate: 10, duration: 10 },
      { name: 'High Load', rate: 50, duration: 10 },
      { name: 'Peak Load', rate: 100, duration: 5 }
    ];

    for (const benchmark of benchmarks) {
      this.log('info', `\n🎯 Running ${benchmark.name}: ${benchmark.rate} tx/s for ${benchmark.duration}s`);
      
      const testConfig = { ...this.config, transactionRate: benchmark.rate, testDuration: benchmark.duration };
      const tester = new WebSocketTester(testConfig);
      
      await tester.runTest();
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

/**
 * Simple WebSocket client for manual testing
 */
export class SimpleWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Received:', data);
          } catch (error) {
            console.log('📨 Received (raw):', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          this.handleReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectInterval);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      console.log('📤 Sent:', message);
    } else {
      console.error('❌ WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Mock data generator for testing
 */
export class MockDataGenerator {
  private static transactionId = 1;
  private static alertId = 1;

  static generateTransaction(): TransactionEvent {
    const id = `tx_${this.transactionId++}`;
    const hash = `hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      hash,
      ledger: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      sourceAccount: `G${Math.random().toString(36).substr(2, 56).toUpperCase()}`,
      fee: (Math.random() * 1000).toFixed(7),
      operationCount: Math.floor(Math.random() * 5) + 1,
      operations: [],
      successful: Math.random() > 0.1 // 90% success rate
    };
  }

  static generateAnalysis(transaction: TransactionEvent): TransactionAnalysis {
    const riskScore = Math.random() * 100;
    const flags: string[] = [];
    
    if (riskScore > 80) {
      flags.push('high_risk');
    }
    if (parseFloat(transaction.fee) > 500) {
      flags.push('high_fee');
    }
    if (transaction.operationCount > 3) {
      flags.push('complex_transaction');
    }

    return {
      transactionId: transaction.id,
      category: riskScore > 70 ? 'suspicious' : 'normal',
      riskScore,
      flags,
      confidence: 0.8 + Math.random() * 0.2,
      analysis: {},
      timestamp: new Date()
    };
  }

  static generateAlert(): Alert {
    const id = `alert_${this.alertId++}`;
    const types = ['high_value_transaction', 'suspicious_pattern', 'rapid_transactions', 'system_error'];
    const severities = ['low', 'medium', 'high', 'critical'];
    
    return {
      id,
      ruleId: 'test_rule',
      type: types[Math.floor(Math.random() * types.length)] as any,
      severity: severities[Math.floor(Math.random() * severities.length)] as any,
      title: `Test Alert ${this.alertId}`,
      message: `This is a test alert generated for testing purposes`,
      data: { timestamp: new Date() },
      timestamp: new Date(),
      acknowledged: false,
      transactionId: `tx_${Math.floor(Math.random() * 1000)}`
    };
  }
}

// Example usage functions
export async function runBasicTest(): Promise<void> {
  const config: WebSocketTestConfig = {
    url: 'ws://localhost:8080',
    testDuration: 30,
    transactionRate: 5,
    enableAlerts: true,
    logLevel: 'info'
  };

  const tester = new WebSocketTester(config);
  await tester.runTest();
}

export async function runStressTest(): Promise<void> {
  const config: WebSocketTestConfig = {
    url: 'ws://localhost:8080',
    testDuration: 60,
    transactionRate: 20,
    enableAlerts: true,
    logLevel: 'warn'
  };

  const tester = new WebSocketTester(config);
  await tester.stressTest(5);
}

export async function runBenchmark(): Promise<void> {
  const config: WebSocketTestConfig = {
    url: 'ws://localhost:8080',
    testDuration: 10,
    transactionRate: 10,
    enableAlerts: false,
    logLevel: 'error'
  };

  const tester = new WebSocketTester(config);
  await tester.benchmark();
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'basic':
      runBasicTest().catch(console.error);
      break;
    case 'stress':
      runStressTest().catch(console.error);
      break;
    case 'benchmark':
      runBenchmark().catch(console.error);
      break;
    default:
      console.log('Usage: ts-node websocket-test.ts [basic|stress|benchmark]');
  }
}
