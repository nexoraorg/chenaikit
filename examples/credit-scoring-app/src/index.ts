// Credit Scoring App - Example application with real-time monitoring
import { TransactionMonitor } from '@chenaikit/core';
import { MonitoringConfig, TransactionEvent, TransactionAnalysis, Alert } from '@chenaikit/core';
import { WebSocketTester, MockDataGenerator } from './utils/websocket-test';

console.log('🚀 Credit Scoring App with Real-time Monitoring starting...');

// Credit scoring logic
export function calculateCreditScore(accountData: any): number {
  // Simplified credit scoring algorithm
  const baseScore = 600;
  const transactionHistory = accountData.transactionHistory || [];
  const avgTransactionAmount = transactionHistory.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0) / Math.max(transactionHistory.length, 1);
  const transactionFrequency = transactionHistory.length;
  const accountAge = accountData.accountAge || 0;
  
  // Score adjustments
  let score = baseScore;
  
  // Transaction frequency bonus
  if (transactionFrequency > 100) score += 50;
  else if (transactionFrequency > 50) score += 25;
  else if (transactionFrequency > 10) score += 10;
  
  // Account age bonus
  if (accountAge > 365) score += 30;
  else if (accountAge > 180) score += 15;
  else if (accountAge > 30) score += 5;
  
  // Average transaction amount consideration
  if (avgTransactionAmount > 1000 && avgTransactionAmount < 10000) score += 20;
  else if (avgTransactionAmount > 10000) score += 10;
  
  return Math.min(850, Math.max(300, score));
}

// Risk assessment logic
export function assessRisk(accountData: any): string {
  const creditScore = calculateCreditScore(accountData);
  
  if (creditScore >= 750) return 'low';
  if (creditScore >= 650) return 'medium';
  if (creditScore >= 550) return 'high';
  return 'critical';
}

// Real-time monitoring integration
class CreditScoringMonitor {
  private monitor: TransactionMonitor;
  private accountScores: Map<string, number> = new Map();
  private riskAlerts: Alert[] = [];

  constructor(config: MonitoringConfig) {
    this.monitor = new TransactionMonitor(config);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.monitor.on('transaction', (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
      this.processTransaction(transaction, analysis);
    });

    this.monitor.on('alert', (alert: Alert) => {
      this.handleAlert(alert);
    });

    this.monitor.on('connected', () => {
      console.log('✅ Real-time monitoring connected');
    });

    this.monitor.on('error', (error: Error) => {
      console.error('❌ Monitoring error:', error.message);
    });
  }

  public processTransaction(transaction: TransactionEvent, analysis: TransactionAnalysis): void {
    // Update account credit scores based on transaction patterns
    const currentScore = this.accountScores.get(transaction.sourceAccount) || 600;
    let newScore = currentScore;

    // Adjust score based on transaction characteristics
    if (analysis.riskScore > 80) {
      newScore = Math.max(300, currentScore - 20); // High risk transaction
    } else if (analysis.riskScore < 20) {
      newScore = Math.min(850, currentScore + 5); // Low risk transaction
    }

    // Consider transaction amount
    const amount = parseFloat(transaction.fee);
    if (amount > 1000) {
      newScore = Math.min(850, newScore + 2); // Large transaction
    }

    this.accountScores.set(transaction.sourceAccount, newScore);

    console.log(`📊 Account ${transaction.sourceAccount.substring(0, 8)}...: Score ${newScore} (Risk: ${analysis.riskScore.toFixed(1)})`);
  }

  private handleAlert(alert: Alert): void {
    this.riskAlerts.push(alert);
    console.log(`🚨 Alert: ${alert.title} - ${alert.message}`);
    
    // Trigger additional fraud detection for high-risk alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      this.triggerFraudDetection(alert);
    }
  }

  private triggerFraudDetection(alert: Alert): void {
    console.log(`🔍 Triggering enhanced fraud detection for alert: ${alert.id}`);
    // In a real implementation, this would trigger additional ML models
  }

  async start(): Promise<void> {
    await this.monitor.start();
    console.log('🎯 Credit scoring monitoring started');
  }

  async stop(): Promise<void> {
    await this.monitor.stop();
    console.log('🛑 Credit scoring monitoring stopped');
  }

  getAccountScore(accountAddress: string): number {
    return this.accountScores.get(accountAddress) || 600;
  }

  getAccountRisk(accountAddress: string): string {
    const score = this.getAccountScore(accountAddress);
    return assessRisk({ accountData: { creditScore: score } });
  }

  getRecentAlerts(): Alert[] {
    return this.riskAlerts.slice(-10); // Last 10 alerts
  }

  getMetrics() {
    return {
      totalAccounts: this.accountScores.size,
      averageScore: Array.from(this.accountScores.values()).reduce((sum, score) => sum + score, 0) / Math.max(this.accountScores.size, 1),
      recentAlerts: this.riskAlerts.length,
      highRiskAccounts: Array.from(this.accountScores.values()).filter(score => score < 500).length
    };
  }
}

// Demo function to showcase the integration
async function runRealTimeDemo(): Promise<void> {
  console.log('\n🎬 Starting Real-time Credit Scoring Demo...\n');

  // Initialize monitoring
  const config: MonitoringConfig = {
    horizonUrl: 'ws://localhost:8080',
    network: 'testnet',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10
  };

  const scoringMonitor = new CreditScoringMonitor(config);

  try {
    // Start monitoring
    await scoringMonitor.start();

    // Simulate some transactions for demo
    console.log('📝 Simulating transactions for demo...');
    
    for (let i = 0; i < 10; i++) {
      const mockTransaction = MockDataGenerator.generateTransaction();
      const mockAnalysis = MockDataGenerator.generateAnalysis(mockTransaction);
      
      // Simulate the transaction processing
      scoringMonitor.processTransaction(mockTransaction, mockAnalysis);
      
      // Add some delay between transactions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Display metrics
    const metrics = scoringMonitor.getMetrics();
    console.log('\n📊 Demo Metrics:');
    console.log(`   Total Accounts: ${metrics.totalAccounts}`);
    console.log(`   Average Score: ${metrics.averageScore.toFixed(1)}`);
    console.log(`   Recent Alerts: ${metrics.recentAlerts}`);
    console.log(`   High Risk Accounts: ${metrics.highRiskAccounts}`);

    // Display recent alerts
    const recentAlerts = scoringMonitor.getRecentAlerts();
    if (recentAlerts.length > 0) {
      console.log('\n🚨 Recent Alerts:');
      recentAlerts.forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.title} (${alert.severity})`);
      });
    }

    // Stop monitoring
    await scoringMonitor.stop();

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// WebSocket testing function
async function runWebSocketTests(): Promise<void> {
  console.log('\n🧪 Running WebSocket Tests...\n');

  const testConfig = {
    url: 'ws://localhost:8080',
    testDuration: 10,
    transactionRate: 2,
    enableAlerts: true,
    logLevel: 'info' as const
  };

  const tester = new WebSocketTester(testConfig);
  
  try {
    await tester.runTest();
  } catch (error) {
    console.error('WebSocket test failed:', error);
  }
}

// Export the main classes and functions
export { CreditScoringMonitor, runRealTimeDemo, runWebSocketTests };

// Run demo if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'demo':
      runRealTimeDemo().catch(console.error);
      break;
    case 'test':
      runWebSocketTests().catch(console.error);
      break;
    default:
      console.log('Available commands:');
      console.log('  demo - Run real-time demo');
      console.log('  test - Run WebSocket tests');
      console.log('\nUsage: ts-node src/index.ts [demo|test]');
  }
}
