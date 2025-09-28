# API Reference

Complete API reference for ChenAIKit packages.

## @chenaikit/core

### StellarConnector

Main class for interacting with Stellar network.

#### Constructor

```typescript
new StellarConnector(config: StellarConfig)
```

**Parameters:**
- `config.network` - Network to connect to (`'testnet'` | `'mainnet'`)
- `config.horizonUrl` - Optional custom Horizon URL

#### Methods

##### getAccount(accountId: string)

Fetches account information from Stellar network.

**Parameters:**
- `accountId` - Stellar account ID

**Returns:** Promise<AccountData>

##### getAccountBalances(accountId: string)

Fetches account balances.

**Parameters:**
- `accountId` - Stellar account ID

**Returns:** Promise<Balance[]>

##### getAccountTransactions(accountId: string, limit?: number)

Fetches account transaction history.

**Parameters:**
- `accountId` - Stellar account ID
- `limit` - Maximum number of transactions (default: 10)

**Returns:** Promise<Transaction[]>

### AIService

Main class for AI operations.

#### Constructor

```typescript
new AIService(config: AIConfig)
```

**Parameters:**
- `config.apiKey` - AI service API key
- `config.baseUrl` - Optional custom base URL

#### Methods

##### calculateCreditScore(accountData: any)

Calculates credit score for account data.

**Parameters:**
- `accountData` - Account information object

**Returns:** Promise<number>

##### detectFraud(transactionData: any)

Detects fraud in transaction data.

**Parameters:**
- `transactionData` - Transaction information object

**Returns:** Promise<boolean>

### CreditScorer

Specialized class for credit scoring operations.

#### Methods

##### calculateScore(accountData: any)

Calculates credit score using advanced algorithms.

**Returns:** Promise<number>

##### getScoreFactors(accountData: any)

Returns factors that influenced the credit score.

**Returns:** Promise<string[]>

### FraudDetector

Specialized class for fraud detection operations.

#### Methods

##### detectAnomalies(transactionData: any)

Detects anomalies in transaction data.

**Returns:** Promise<boolean>

##### getRiskFactors(transactionData: any)

Returns risk factors identified in the transaction.

**Returns:** Promise<string[]>

## @chenaikit/cli

Command-line interface for ChenAIKit operations.

### Commands

#### Account Operations

```bash
chenaikit account balance <accountId>
chenaikit account transactions <accountId>
```

#### AI Operations

```bash
chenaikit ai credit-score <accountId>
chenaikit ai fraud-detect --transaction-id <id>
```

#### Contract Operations

```bash
chenaikit contract generate <template>
chenaikit contract deploy <contract>
```

## Types

### StellarConfig

```typescript
interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
}
```

### AIConfig

```typescript
interface AIConfig {
  apiKey: string;
  baseUrl?: string;
}
```

### AccountData

```typescript
interface AccountData {
  id: string;
  balances: Balance[];
  sequence: string;
  // ... other Stellar account fields
}
```

### Balance

```typescript
interface Balance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  hash: string;
  created_at: string;
  // ... other Stellar transaction fields
}
