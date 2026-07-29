# Oracle Node Package

TypeScript service for running oracle nodes in the Decentralized Model Oracle Network (DMON).

## Overview

The oracle node is responsible for:
- Running approved ML models for inference
- Signing inference results with a Stellar keypair
- Executing commit-reveal transactions with proper timing
- Checking for model drift before serving inference
- Providing health and liveness metrics
- Implementing retry/backoff logic for network resilience

## Installation

```bash
npm install @chenaikit/oracle-node
```

## Usage

```typescript
import { OracleWorker } from '@chenaikit/oracle-node';

const config = {
  networkUrl: 'https://testnet.soroban.network',
  networkPassphrase: 'Test SDF Network ; September 2015',
  oracleContractId: 'YOUR_ORACLE_CONTRACT_ID',
  nodeKeypair: {
    publicKey: 'YOUR_PUBLIC_KEY',
    secretKey: 'YOUR_SECRET_KEY',
  },
  modelType: 'credit-score',
  commitPhaseDuration: 100, // seconds
  revealPhaseDuration: 100, // seconds
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
  healthCheckInterval: 5000, // milliseconds
};

const worker = new OracleWorker(config);

// Start the worker
await worker.start();

// Process an inference request
const result = await worker.processInferenceRequest({
  requestId: 'req-123',
  account: 'GABC...',
  inputData: { /* ... */ },
  modelHash: 'abc123...',
});

// Get metrics
const metrics = worker.getMetrics();

// Get health status
const health = await worker.getHealthStatus();

// Stop the worker
await worker.stop();
```

## Architecture

```
OracleWorker
├── CommitRevealManager (handles commit-reveal scheme)
├── MetricsCollector (tracks performance metrics)
└── Model Inference (calls into @chenaikit/core)
```

## Configuration

See `OracleConfig` in `src/types.ts` for full configuration options.

## Security Considerations

- Model drift detection is integrated with `packages/core/src/ai/mlops/driftDetector.ts`
- All inference results are cryptographically signed
- Commit-reveal scheme prevents front-running
- Node identity is tied to Stellar keypair

## Testing

```bash
npm test
```

## Building

```bash
npm run build
```

## License

MIT
