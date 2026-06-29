# ADR 003: TypeScript SDK Design and Architecture

## Status
Accepted

## Context
ChenAIKit needs a developer-friendly SDK that abstracts blockchain and AI complexity while providing:
- Type safety for better developer experience
- Modular architecture for tree-shaking
- Support for both Node.js and browser environments
- Extensibility for future features
- Clear separation of concerns

## Decision
We will build a TypeScript-first SDK with a modular architecture organized by domain.

### SDK Structure
```
@chenaikit/core/
├── src/
│   ├── stellar/          # Stellar network operations
│   ├── ai/               # AI service integrations
│   ├── blockchain/       # Blockchain monitoring & governance
│   ├── utils/            # Shared utilities
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Main entry point
```

### Module Organization
Each domain module exports a focused API:
- **stellar/**: `StellarConnector`, `AssetManager`, `DEXIntegration`
- **ai/**: `AIService`, `CreditScorer`, `FraudDetector`
- **blockchain/**: `TransactionMonitor`, `GovernanceClient`
- **utils/**: `ValidationRules`, `ChartHelpers`, `ExportUtils`

## Rationale

### Why TypeScript?

1. **Type Safety**: Catch errors at compile time, not runtime
2. **IDE Support**: Excellent autocomplete and inline documentation
3. **Refactoring**: Safe refactoring across the codebase
4. **Documentation**: Types serve as living documentation
5. **Ecosystem**: Largest JavaScript ecosystem with type definitions

### Why Modular Architecture?

1. **Tree Shaking**: Unused code is eliminated in production builds
2. **Clear Boundaries**: Each module has a single responsibility
3. **Independent Testing**: Modules can be tested in isolation
4. **Parallel Development**: Teams can work on different modules
5. **Gradual Adoption**: Users can import only what they need

### Design Principles

1. **Explicit over Implicit**: Clear, verbose APIs over magic
2. **Fail Fast**: Validate inputs early and throw descriptive errors
3. **Async by Default**: All I/O operations return Promises
4. **Immutable Data**: Avoid mutating input parameters
5. **Composable**: Small, focused functions that work together

## Consequences

### Positive
- **Developer Experience**: IntelliSense, type checking, and refactoring support
- **Maintainability**: Clear structure makes code easier to understand
- **Performance**: Tree-shaking reduces bundle size for web apps
- **Reliability**: Type system catches many bugs before runtime
- **Documentation**: Types provide inline documentation
- **Testing**: Easier to mock and test individual modules

### Negative
- **Build Step**: Requires TypeScript compilation
- **Learning Curve**: Developers need TypeScript knowledge
- **Verbosity**: More code compared to plain JavaScript
- **Compilation Time**: Adds time to development workflow

### Neutral
- **Type Definitions**: Need to maintain types for all public APIs
- **Breaking Changes**: Type changes can be breaking changes

## API Design Patterns

### 1. Configuration Objects
Use configuration objects instead of multiple parameters:

```typescript
// Good
const stellar = new StellarConnector({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  timeout: 30000
});

// Avoid
const stellar = new StellarConnector('testnet', 'https://...', 30000);
```

### 2. Builder Pattern for Complex Objects
```typescript
const monitor = new TransactionMonitor(config)
  .addFilter({ account: 'GABC...' })
  .addAlertRule({
    type: 'high_value',
    threshold: 10000,
    action: 'webhook'
  })
  .on('alert', handleAlert);

await monitor.start();
```

### 3. Async/Await for I/O
```typescript
// All I/O operations are async
async function getAccountScore(accountId: string): Promise<number> {
  const account = await stellar.getAccount(accountId);
  const score = await ai.calculateCreditScore(account);
  return score;
}
```

### 4. Error Handling
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

// Usage
throw new ChenAIKitError(
  'Account not found',
  'ACCOUNT_NOT_FOUND',
  { accountId }
);
```

### 5. Event Emitters for Real-time Updates
```typescript
import { EventEmitter } from 'eventemitter3';

class TransactionMonitor extends EventEmitter {
  on(event: 'transaction', handler: (tx: Transaction) => void): this;
  on(event: 'alert', handler: (alert: Alert) => void): this;
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }
}
```

## Type System Design

### Strict Type Checking
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Discriminated Unions
```typescript
type TransactionStatus = 
  | { status: 'pending'; submittedAt: Date }
  | { status: 'confirmed'; confirmedAt: Date; ledger: number }
  | { status: 'failed'; error: string };

function handleTransaction(tx: TransactionStatus) {
  switch (tx.status) {
    case 'pending':
      console.log('Submitted at', tx.submittedAt);
      break;
    case 'confirmed':
      console.log('Confirmed in ledger', tx.ledger);
      break;
    case 'failed':
      console.log('Failed:', tx.error);
      break;
  }
}
```

### Generic Types for Flexibility
```typescript
interface Repository<T> {
  find(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class AccountRepository implements Repository<Account> {
  // Implementation
}
```

## Module Exports

### Barrel Exports
Each module has an index.ts that re-exports public APIs:

```typescript
// src/stellar/index.ts
export { StellarConnector } from './connector';
export { AssetManager } from './assets';
export { DEXIntegration } from './dex';
export type { StellarConfig, Account, Balance } from './types';
```

### Main Entry Point
```typescript
// src/index.ts
export * from './stellar';
export * from './ai';
export * from './blockchain';
export * from './utils';
export type * from './types';
```

### Tree-Shakeable Exports
Users can import specific modules:
```typescript
// Import everything
import { StellarConnector, AIService } from '@chenaikit/core';

// Import specific module (better for tree-shaking)
import { StellarConnector } from '@chenaikit/core/stellar';
import { AIService } from '@chenaikit/core/ai';
```

## Browser vs Node.js Support

### Conditional Exports
```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./stellar": {
      "import": "./dist/esm/stellar/index.js",
      "require": "./dist/cjs/stellar/index.js",
      "types": "./dist/types/stellar/index.d.ts"
    }
  }
}
```

### Platform-Specific Code
```typescript
// Use conditional imports for platform-specific features
const WebSocket = typeof window !== 'undefined'
  ? window.WebSocket
  : require('ws');
```

## Testing Strategy

### Unit Tests
- Test each module in isolation
- Mock external dependencies
- Use Jest with ts-jest

### Integration Tests
- Test module interactions
- Use real testnet for blockchain operations
- Mock AI services with predictable responses

### Type Tests
```typescript
// Ensure types are correct
import { expectType } from 'tsd';

const connector = new StellarConnector({ network: 'testnet' });
const account = await connector.getAccount('GABC...');

expectType<Account>(account);
expectType<Balance[]>(account.balances);
```

## Documentation Strategy

### TSDoc Comments
```typescript
/**
 * Calculates credit score for a Stellar account.
 * 
 * @param accountId - Stellar account public key (G...)
 * @returns Credit score between 0-1000
 * @throws {ChenAIKitError} If account not found or API error
 * 
 * @example
 * ```typescript
 * const score = await ai.calculateCreditScore('GABC...');
 * console.log(`Score: ${score}/1000`);
 * ```
 */
async calculateCreditScore(accountId: string): Promise<number> {
  // Implementation
}
```

### Generated API Docs
Use TypeDoc to generate API documentation from TSDoc comments:
```bash
typedoc --out docs/api src/index.ts
```

## Versioning and Breaking Changes

### Semantic Versioning
- **Major**: Breaking changes to public API
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### Deprecation Strategy
```typescript
/**
 * @deprecated Use `calculateCreditScore` instead. Will be removed in v2.0.0.
 */
async getCreditScore(accountId: string): Promise<number> {
  console.warn('getCreditScore is deprecated, use calculateCreditScore');
  return this.calculateCreditScore(accountId);
}
```

## Alternatives Considered

### Plain JavaScript
- **Pros**: No build step, simpler setup
- **Cons**: No type safety, poor IDE support, more runtime errors
- **Rejected**: Type safety is critical for SDK reliability

### Flow
- **Pros**: Type checking for JavaScript
- **Cons**: Smaller ecosystem, less tooling support, declining adoption
- **Rejected**: TypeScript has better ecosystem and tooling

### ReScript/Reason
- **Pros**: Strong type system, functional programming
- **Cons**: Steep learning curve, smaller ecosystem, unfamiliar syntax
- **Rejected**: TypeScript is more accessible to JavaScript developers

## References
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [API Design Patterns](https://www.patterns.dev/)
- [TSDoc Specification](https://tsdoc.org/)

## Date
2024-10-04

## Authors
ChenAIKit Team
