# Core SDK API Reference

Complete API reference for `@chenaikit/core` package.

## Installation

```bash
npm install @chenaikit/core
# or
pnpm add @chenaikit/core
# or
yarn add @chenaikit/core
```

## Table of Contents

- [Stellar Module](#stellar-module)
- [AI Module](#ai-module)
- [Blockchain Module](#blockchain-module)
- [Utils Module](#utils-module)
- [Types](#types)

---

## Stellar Module

### StellarConnector

Main class for interacting with the Stellar network.

#### Constructor

```typescript
new StellarConnector(config: StellarConfig)
```

**Parameters:**
- `config.network` - Network to connect to (`'testnet'` | `'mainnet'`)
- `config.horizonUrl` - Optional custom Horizon URL
- `config.timeout` - Optional request timeout in milliseconds (default: 30000)

**Example:**
```typescript
import { StellarConnector } from '@chenaikit/core';

const stellar = new StellarConnector({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  timeout: 30000
});
```

#### Methods

##### getAccount(accountId: string): Promise<Account>

Fetches account information from Stellar network.

**Parameters:**
- `accountId` - Stellar account public key (starts with 'G')

**Returns:** Promise resolving to Account object

**Throws:** 
- `ChenAIKitError` with code `ACCOUNT_NOT_FOUND` if account doesn't exist
- `ChenAIKitError` with code `NETWORK_ERROR` if network request fails

**Example:**
```typescript
const account = await stellar.getAccount('GABC...');
console.log('Account ID:', account.id);
console.log('Sequence:', account.sequence);
console.log('Balances:', account.balances);
```

##### getAccountBalances(accountId: string): Promise<Balance[]>

Fetches account balances.

**Parameters:**
- `accountId` - Stellar account public key

**Returns:** Promise resolving to array of Balance objects

**Example:**
```typescript
const balances = await stellar.getAccountBalances('GABC...');
balances.forEach(balance => {
  console.log(`${balance.asset_type}: ${balance.balance}`);
});
```

##### getAccountTransactions(accountId: string, options?: TransactionOptions): Promise<Transaction[]>

Fetches account transaction history.

**Parameters:**
- `accountId` - Stellar account public key
- `options.limit` - Maximum number of transactions (default: 10, max: 200)
- `options.order` - Sort order ('asc' | 'desc', default: 'desc')
- `options.cursor` - Pagination cursor

**Returns:** Promise resolving to array of Transaction objects

**Example:**
```typescript
const transactions = await stellar.getAccountTransactions('GABC...', {
  limit: 50,
  order: 'desc'
});

transactions.forEach(tx => {
  console.log(`${tx.id}: ${tx.operation_count} operations`);
});
```

##### invokeContract(contractId: string, method: string, args: any[]): Promise<any>

Invokes a Soroban smart contract method.

**Parameters:**
- `contractId` - Contract address (starts with 'C')
- `method` - Contract method name
- `args` - Array of arguments to pass to the method

**Returns:** Promise resolving to contract method return value

**Example:**
```typescript
const score = await stellar.invokeContract(
  'CAAAA...',
  'get_score',
  ['GABC...']
);
console.log('Credit score:', score);
```

##### submitTransaction(transaction: Transaction): Promise<TransactionResult>

Submits a signed transaction to the network.

**Parameters:**
- `transaction` - Signed Stellar transaction

**Returns:** Promise resolving to transaction result

**Example:**
```typescript
const result = await stellar.submitTransaction(signedTx);
console.log('Transaction hash:', result.hash);
console.log('Ledger:', result.ledger);
```

---

## AI Module

### AIService

Main class for AI operations including credit scoring and fraud detection.

#### Constructor

```typescript
new AIService(config: AIConfig)
```

**Parameters:**
- `config.apiKey` - AI service API key
- `config.baseUrl` - Optional custom base URL
- `config.timeout` - Optional request timeout (default: 60000)
- `config.retries` - Optional number of retries (default: 3)

**Example:**
```typescript
import { AIService } from '@chenaikit/core';

const ai = new AIService({
  apiKey: process.env.AI_API_KEY,
  baseUrl: 'https://api.chenaikit.com',
  timeout: 60000
});
```

#### Methods

##### calculateCreditScore(accountData: AccountData): Promise<number>

Calculates credit score for account data using AI models.

**Parameters:**
- `accountData` - Account information object containing balances, transactions, etc.

**Returns:** Promise resolving to credit score (0-1000)

**Example:**
```typescript
const account = await stellar.getAccount('GABC...');
const score = await ai.calculateCreditScore(account);
console.log(`Credit Score: ${score}/1000`);
```

##### getScoreFactors(accountData: AccountData): Promise<ScoreFactor[]>

Returns factors that influenced the credit score.

**Parameters:**
- `accountData` - Account information object

**Returns:** Promise resolving to array of score factors

**Example:**
```typescript
const factors = await ai.getScoreFactors(account);
factors.forEach(factor => {
  console.log(`${factor.name}: ${factor.impact} (${factor.weight}%)`);
});
```

##### detectFraud(transactionData: TransactionData): Promise<FraudResult>

Detects fraud in transaction data using AI models.

**Parameters:**
- `transactionData` - Transaction information object

**Returns:** Promise resolving to fraud detection result

**Example:**
```typescript
const result = await ai.detectFraud(transaction);
console.log('Is Fraud:', result.isFraud);
console.log('Confidence:', result.confidence);
console.log('Risk Factors:', result.riskFactors);
```

##### getRiskFactors(transactionData: TransactionData): Promise<RiskFactor[]>

Returns risk factors identified in the transaction.

**Parameters:**
- `transactionData` - Transaction information object

**Returns:** Promise resolving to array of risk factors

**Example:**
```typescript
const risks = await ai.getRiskFactors(transaction);
risks.forEach(risk => {
  console.log(`${risk.type}: ${risk.severity} - ${risk.description}`);
});
```

### CreditScorer

Specialized class for credit scoring operations with advanced features.

#### Constructor

```typescript
new CreditScorer(config: AIConfig)
```

#### Methods

##### calculateScore(accountData: AccountData, options?: ScoringOptions): Promise<CreditScore>

Calculates credit score with detailed breakdown.

**Parameters:**
- `accountData` - Account information
- `options.includeFactors` - Include factor breakdown (default: true)
- `options.includeHistory` - Include historical scores (default: false)

**Returns:** Promise resolving to detailed credit score object

**Example:**
```typescript
import { CreditScorer } from '@chenaikit/core';

const scorer = new CreditScorer({ apiKey: process.env.AI_API_KEY });
const result = await scorer.calculateScore(account, {
  includeFactors: true,
  includeHistory: true
});

console.log('Score:', result.score);
console.log('Grade:', result.grade); // A, B, C, D, F
console.log('Factors:', result.factors);
console.log('History:', result.history);
```

##### compareScores(accountId1: string, accountId2: string): Promise<ScoreComparison>

Compares credit scores between two accounts.

**Parameters:**
- `accountId1` - First account ID
- `accountId2` - Second account ID

**Returns:** Promise resolving to comparison result

**Example:**
```typescript
const comparison = await scorer.compareScores('GABC...', 'GDEF...');
console.log('Difference:', comparison.difference);
console.log('Better Account:', comparison.betterAccount);
```

### FraudDetector

Specialized class for fraud detection operations.

#### Constructor

```typescript
new FraudDetector(config: AIConfig)
```

#### Methods

##### detectAnomalies(transactionData: TransactionData): Promise<Anomaly[]>

Detects anomalies in transaction data.

**Parameters:**
- `transactionData` - Transaction information

**Returns:** Promise resolving to array of detected anomalies

**Example:**
```typescript
import { FraudDetector } from '@chenaikit/core';

const detector = new FraudDetector({ apiKey: process.env.AI_API_KEY });
const anomalies = await detector.detectAnomalies(transaction);

anomalies.forEach(anomaly => {
  console.log(`${anomaly.type}: ${anomaly.severity}`);
  console.log(`Description: ${anomaly.description}`);
});
```

##### analyzePattern(transactions: Transaction[]): Promise<PatternAnalysis>

Analyzes patterns across multiple transactions.

**Parameters:**
- `transactions` - Array of transactions to analyze

**Returns:** Promise resolving to pattern analysis result

**Example:**
```typescript
const transactions = await stellar.getAccountTransactions('GABC...', {
  limit: 100
});
const analysis = await detector.analyzePattern(transactions);

console.log('Suspicious Patterns:', analysis.suspiciousPatterns);
console.log('Risk Score:', analysis.riskScore);
```

---

## Blockchain Module

### TransactionMonitor

Real-time transaction monitoring with WebSocket streaming.

#### Constructor

```typescript
new TransactionMonitor(config: MonitoringConfig)
```

**Parameters:**
- `config.horizonUrl` - Stellar Horizon API URL
- `config.network` - Network ('testnet' | 'mainnet')
- `config.reconnectInterval` - Auto-reconnect interval in ms (default: 5000)
- `config.maxReconnectAttempts` - Max reconnection attempts (default: 10)
- `config.batchSize` - Processing batch size (default: 100)
- `config.alertThresholds` - Alert configuration
- `config.filters` - Transaction filters

**Example:**
```typescript
import { TransactionMonitor } from '@chenaikit/core';

const monitor = new TransactionMonitor({
  horizonUrl: 'https://horizon-testnet.stellar.org',
  network: 'testnet',
  alertThresholds: {
    highVolumeAmount: 10000,
    rapidTransactionCount: 20,
    rapidTransactionWindow: 300000
  },
  filters: {
    accounts: ['GABC...', 'GDEF...'],
    minAmount: 100
  }
});
```

#### Methods

##### start(): Promise<void>

Starts the transaction monitor.

**Example:**
```typescript
await monitor.start();
console.log('Monitor started');
```

##### stop(): Promise<void>

Stops the transaction monitor.

**Example:**
```typescript
await monitor.stop();
console.log('Monitor stopped');
```

##### addFilter(filter: TransactionFilter): void

Adds a transaction filter.

**Parameters:**
- `filter.account` - Filter by account
- `filter.assetType` - Filter by asset type
- `filter.minAmount` - Minimum transaction amount
- `filter.maxAmount` - Maximum transaction amount

**Example:**
```typescript
monitor.addFilter({
  account: 'GABC...',
  minAmount: 1000,
  assetType: 'native'
});
```

##### addAlertRule(rule: AlertRule): void

Adds an alert rule.

**Parameters:**
- `rule.type` - Alert type ('high_value' | 'fraud' | 'rapid_transactions' | 'suspicious_pattern')
- `rule.condition` - Condition to trigger alert
- `rule.action` - Action to take ('webhook' | 'email' | 'log')
- `rule.threshold` - Threshold value

**Example:**
```typescript
monitor.addAlertRule({
  type: 'high_value',
  threshold: 50000,
  action: 'webhook',
  webhookUrl: 'https://api.example.com/alerts'
});
```

#### Events

##### on('transaction', handler: (tx: Transaction, analysis: TransactionAnalysis) => void)

Emitted when a new transaction is detected.

**Example:**
```typescript
monitor.on('transaction', (tx, analysis) => {
  console.log(`New transaction: ${tx.hash}`);
  console.log(`Category: ${analysis.category}`);
  console.log(`Risk Score: ${analysis.riskScore}`);
});
```

##### on('alert', handler: (alert: Alert) => void)

Emitted when an alert is triggered.

**Example:**
```typescript
monitor.on('alert', (alert) => {
  console.log(`Alert: ${alert.title}`);
  console.log(`Severity: ${alert.severity}`);
  console.log(`Details: ${alert.details}`);
});
```

##### on('error', handler: (error: Error) => void)

Emitted when an error occurs.

**Example:**
```typescript
monitor.on('error', (error) => {
  console.error('Monitor error:', error.message);
});
```

---

## Utils Module

### ValidationRules

Validation utilities for forms and data.

#### Methods

##### email(message?: string): ValidationRule

Creates email validation rule.

**Example:**
```typescript
import { ValidationRules } from '@chenaikit/core';

const emailRule = ValidationRules.email('Invalid email address');
const result = emailRule('user@example.com');
// result: null (valid)
```

##### stellarAddress(message?: string): ValidationRule

Creates Stellar address validation rule.

**Example:**
```typescript
const addressRule = ValidationRules.stellarAddress('Invalid Stellar address');
const result = addressRule('GABC...');
// result: null if valid, error message if invalid
```

##### required(message?: string): ValidationRule

Creates required field validation rule.

**Example:**
```typescript
const requiredRule = ValidationRules.required('This field is required');
```

##### minLength(length: number, message?: string): ValidationRule

Creates minimum length validation rule.

**Example:**
```typescript
const minRule = ValidationRules.minLength(8, 'Must be at least 8 characters');
```

##### custom(validator: (value: any) => string | null): ValidationRule

Creates custom validation rule.

**Example:**
```typescript
const customRule = ValidationRules.custom((value) => {
  if (value === 'forbidden') {
    return 'This value is not allowed';
  }
  return null;
});
```

### ChartHelpers

Utilities for data visualization.

#### Methods

##### formatChartData(data: any[], xKey: string, yKey: string): ChartData[]

Formats data for chart libraries.

**Example:**
```typescript
import { ChartHelpers } from '@chenaikit/core';

const transactions = [...]; // Array of transactions
const chartData = ChartHelpers.formatChartData(
  transactions,
  'created_at',
  'amount'
);
```

##### aggregateByTime(data: any[], timeKey: string, valueKey: string, interval: 'hour' | 'day' | 'week'): AggregatedData[]

Aggregates data by time intervals.

**Example:**
```typescript
const dailyVolume = ChartHelpers.aggregateByTime(
  transactions,
  'created_at',
  'amount',
  'day'
);
```

### ExportUtils

Utilities for exporting data.

#### Methods

##### toCSV(data: any[], filename: string): void

Exports data to CSV file.

**Example:**
```typescript
import { ExportUtils } from '@chenaikit/core';

ExportUtils.toCSV(transactions, 'transactions.csv');
```

##### toJSON(data: any[], filename: string): void

Exports data to JSON file.

**Example:**
```typescript
ExportUtils.toJSON(accountData, 'account-data.json');
```

---

## Types

### StellarConfig

```typescript
interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
  timeout?: number;
}
```

### AIConfig

```typescript
interface AIConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}
```

### Account

```typescript
interface Account {
  id: string;
  account_id: string;
  sequence: string;
  balances: Balance[];
  subentry_count: number;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
  signers: Signer[];
}
```

### Balance

```typescript
interface Balance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_charged: string;
  operation_count: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  successful: boolean;
}
```

### CreditScore

```typescript
interface CreditScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: ScoreFactor[];
  history?: HistoricalScore[];
  calculatedAt: Date;
}
```

### ScoreFactor

```typescript
interface ScoreFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  value: any;
  description: string;
}
```

### FraudResult

```typescript
interface FraudResult {
  isFraud: boolean;
  confidence: number;
  riskScore: number;
  riskFactors: RiskFactor[];
  recommendation: string;
}
```

### RiskFactor

```typescript
interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
}
```

### Alert

```typescript
interface Alert {
  id: string;
  type: 'high_value' | 'fraud' | 'rapid_transactions' | 'suspicious_pattern';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  transaction?: Transaction;
  timestamp: Date;
  acknowledged: boolean;
}
```

---

## Error Handling

All methods may throw `ChenAIKitError`:

```typescript
class ChenAIKitError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ChenAIKitError';
  }
}
```

### Error Codes

- `ACCOUNT_NOT_FOUND` - Stellar account doesn't exist
- `NETWORK_ERROR` - Network request failed
- `INVALID_PARAMETER` - Invalid parameter provided
- `API_ERROR` - AI service API error
- `CONTRACT_ERROR` - Smart contract execution error
- `VALIDATION_ERROR` - Data validation failed
- `TIMEOUT_ERROR` - Request timeout
- `AUTHENTICATION_ERROR` - Authentication failed

### Example Error Handling

```typescript
try {
  const account = await stellar.getAccount('GABC...');
} catch (error) {
  if (error instanceof ChenAIKitError) {
    console.error(`Error ${error.code}: ${error.message}`);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Examples

### Complete Credit Scoring Example

```typescript
import { StellarConnector, CreditScorer } from '@chenaikit/core';

async function analyzeCreditworthiness(accountId: string) {
  // Initialize services
  const stellar = new StellarConnector({ network: 'testnet' });
  const scorer = new CreditScorer({ apiKey: process.env.AI_API_KEY });

  // Fetch account data
  const account = await stellar.getAccount(accountId);
  const transactions = await stellar.getAccountTransactions(accountId, {
    limit: 100
  });

  // Calculate credit score
  const result = await scorer.calculateScore(account, {
    includeFactors: true,
    includeHistory: true
  });

  // Display results
  console.log(`Credit Score: ${result.score}/1000 (Grade: ${result.grade})`);
  console.log('\nScore Factors:');
  result.factors.forEach(factor => {
    console.log(`  ${factor.name}: ${factor.impact} (${factor.weight}%)`);
  });

  return result;
}
```

### Real-time Monitoring Example

```typescript
import { TransactionMonitor, FraudDetector } from '@chenaikit/core';

async function monitorTransactions() {
  const monitor = new TransactionMonitor({
    horizonUrl: 'https://horizon-testnet.stellar.org',
    network: 'testnet',
    alertThresholds: {
      highVolumeAmount: 10000,
      rapidTransactionCount: 20
    }
  });

  const detector = new FraudDetector({ apiKey: process.env.AI_API_KEY });

  // Handle transactions
  monitor.on('transaction', async (tx, analysis) => {
    console.log(`Transaction: ${tx.hash}`);
    
    // Check for fraud
    const fraudResult = await detector.detectFraud(tx);
    if (fraudResult.isFraud) {
      console.log(`⚠️  Fraud detected! Confidence: ${fraudResult.confidence}`);
    }
  });

  // Handle alerts
  monitor.on('alert', (alert) => {
    console.log(`🚨 Alert: ${alert.title} (${alert.severity})`);
  });

  // Start monitoring
  await monitor.start();
}
```

---

## See Also

- [Getting Started Guide](../getting-started.md)
- [Tutorials](../tutorials/)
- [Architecture Documentation](../architecture/)
- [Examples](../../examples/)
