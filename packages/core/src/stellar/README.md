# Stellar Horizon API Wrapper

A comprehensive TypeScript wrapper for the Stellar Horizon API that provides strongly-typed interfaces, rate limiting, error handling, and retry logic.

## Features

- ✅ **Account Data Fetching**: Get account information, balances, and metadata
- ✅ **Transaction History**: Retrieve transaction history with pagination support
- ✅ **Payment Operations**: Fetch payment operations and transaction details
- ✅ **Ledger Information**: Access ledger data and network statistics
- ✅ **Rate Limiting**: Built-in rate limiting to prevent API throttling
- ✅ **Error Handling**: Comprehensive error handling with meaningful messages
- ✅ **Retry Logic**: Automatic retry with exponential backoff
- ✅ **TypeScript Support**: Fully typed interfaces for all API responses
- ✅ **Streaming Support**: Real-time account updates (polling-based)

## Installation

```bash
npm install @chenaikit/core
```

## Quick Start

```typescript
import { HorizonConnector, HorizonConfig } from '@chenaikit/core';

// Configuration
const config: HorizonConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  apiKey: process.env.STELLAR_API_KEY, // Optional
  rateLimit: {
    requestsPerMinute: 60,
    burstLimit: 10,
    retryAfterMs: 1000
  },
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Create connector
const horizon = new HorizonConnector(config);

// Fetch account data
const account = await horizon.getAccount('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J');
console.log('Account sequence:', account.sequence);
console.log('Account balances:', account.balances);
```

## API Reference

### Configuration

```typescript
interface HorizonConfig {
  horizonUrl: string;                    // Horizon server URL
  networkPassphrase: string;            // Network passphrase
  apiKey?: string;                      // Optional API key
  rateLimit?: RateLimitConfig;          // Rate limiting settings
  timeout?: number;                      // Request timeout (default: 30000ms)
  retryAttempts?: number;               // Retry attempts (default: 3)
  retryDelay?: number;                  // Retry delay (default: 1000ms)
}

interface RateLimitConfig {
  requestsPerMinute: number;            // Max requests per minute
  burstLimit: number;                   // Burst limit
  retryAfterMs: number;                 // Retry delay on rate limit
}
```

### Account Operations

#### Get Account Information
```typescript
const account = await horizon.getAccount(accountId: string): Promise<HorizonAccount>
```

#### Get Account Balances
```typescript
const balances = await horizon.getAccountBalances(accountId: string): Promise<HorizonBalance[]>
```

#### Get Account Transactions
```typescript
const result = await horizon.getAccountTransactions(
  accountId: string,
  options?: PaginationOptions
): Promise<{ records: HorizonTransaction[]; next?: string; prev?: string }>
```

#### Get Account Payments
```typescript
const result = await horizon.getAccountPayments(
  accountId: string,
  options?: PaginationOptions
): Promise<{ records: HorizonPaymentOperation[]; next?: string; prev?: string }>
```

### Transaction Operations

#### Get Transaction Details
```typescript
const transaction = await horizon.getTransaction(transactionHash: string): Promise<HorizonTransaction>
```

#### Get Transaction Operations
```typescript
const result = await horizon.getTransactionOperations(
  transactionHash: string,
  options?: PaginationOptions
): Promise<{ records: HorizonOperation[]; next?: string; prev?: string }>
```

#### Get Transaction Effects
```typescript
const result = await horizon.getTransactionEffects(
  transactionHash: string,
  options?: PaginationOptions
): Promise<{ records: HorizonEffect[]; next?: string; prev?: string }>
```

### Ledger Operations

#### Get Ledger Information
```typescript
const ledger = await horizon.getLedger(ledgerSequence: number): Promise<HorizonLedger>
```

#### Get Recent Ledgers
```typescript
const result = await horizon.getLedgers(options?: PaginationOptions): Promise<{ records: HorizonLedger[]; next?: string; prev?: string }>
```

### Network Operations

#### Get Network Information
```typescript
const networkInfo = await horizon.getNetworkInfo(): Promise<any>
```

#### Get Fee Statistics
```typescript
const feeStats = await horizon.getFeeStats(): Promise<any>
```

### Utility Methods

#### Health Check
```typescript
const isHealthy = await horizon.healthCheck(): Promise<boolean>
```

#### Stream Account Updates
```typescript
const streamPromise = await horizon.streamAccount(
  accountId: string,
  callback: (data: any) => void
): Promise<void>

// Stop streaming
horizon.stopStreaming();
```

## TypeScript Interfaces

### Core Types

```typescript
interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring: number;
  num_sponsored: number;
  inflation_destination?: string;
  home_domain?: string;
  last_modified_ledger: number;
  last_modified_time: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
  balances: HorizonBalance[];
  signers: HorizonSigner[];
  data: Record<string, string>;
}

interface HorizonBalance {
  balance: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  limit?: string;
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
  is_clawback_enabled?: boolean;
}

interface HorizonTransaction {
  id: string;
  paging_token: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_account?: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  fee_meta_xdr: string;
  memo_type: string;
  memo?: string;
  signatures: string[];
  valid_after?: string;
  valid_before?: string;
  operations: HorizonOperation[];
  effects: HorizonEffect[];
  precedes: string;
  succeeds: string;
}
```

### Pagination Options

```typescript
interface PaginationOptions {
  cursor?: string;        // Pagination cursor
  order?: 'asc' | 'desc'; // Sort order
  limit?: number;         // Number of records (max 200)
}
```

## Error Handling

The wrapper provides comprehensive error handling with meaningful error messages:

```typescript
try {
  const account = await horizon.getAccount('INVALID_ADDRESS');
} catch (error) {
  console.error('Error:', error.message);
  // Output: "Invalid Stellar address format"
}

try {
  const account = await horizon.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
} catch (error) {
  console.error('Error:', error.message);
  // Output: "Account not found: GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
}
```

## Rate Limiting

The connector includes built-in rate limiting to prevent API throttling:

```typescript
const config: HorizonConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rateLimit: {
    requestsPerMinute: 60,    // Max 60 requests per minute
    burstLimit: 10,           // Allow bursts of 10 requests
    retryAfterMs: 1000        // Wait 1 second on rate limit
  }
};
```

## Examples

### Basic Account Operations

```typescript
import { HorizonConnector } from '@chenaikit/core';

const horizon = new HorizonConnector({
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
});

// Get account information
const account = await horizon.getAccount('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J');
console.log('Account sequence:', account.sequence);

// Get account balances
const balances = await horizon.getAccountBalances('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J');
balances.forEach(balance => {
  if (balance.asset_type === 'native') {
    console.log(`XLM Balance: ${balance.balance}`);
  } else {
    console.log(`${balance.asset_code} Balance: ${balance.balance}`);
  }
});
```

### Transaction History with Pagination

```typescript
// Get recent transactions
const transactions = await horizon.getAccountTransactions('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J', {
  limit: 10,
  order: 'desc'
});

console.log(`Found ${transactions.records.length} transactions:`);
transactions.records.forEach(tx => {
  console.log(`- ${tx.hash}: ${tx.successful ? 'SUCCESS' : 'FAILED'}`);
});

// Get next page
if (transactions.next) {
  const nextPage = await horizon.getAccountTransactions('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J', {
    cursor: transactions.records[transactions.records.length - 1].paging_token,
    limit: 10,
    order: 'desc'
  });
}
```

### Real-time Account Monitoring

```typescript
// Stream account updates
const streamPromise = horizon.streamAccount('GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J', (accountData) => {
  console.log('Account updated:', {
    sequence: accountData.sequence,
    balances: accountData.balances.length,
    lastModified: accountData.last_modified_time
  });
});

// Stop streaming after 30 seconds
setTimeout(() => {
  horizon.stopStreaming();
}, 30000);

await streamPromise;
```

## Testing

The package includes comprehensive integration tests that verify all functionality against the Stellar testnet:

```bash
npm test
```

## Network Support

- **Testnet**: `https://horizon-testnet.stellar.org`
- **Mainnet**: `https://horizon.stellar.org`
- **Futurenet**: `https://horizon-futurenet.stellar.org`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
