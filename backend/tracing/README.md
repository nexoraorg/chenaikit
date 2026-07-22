# Distributed Tracing - Quick Start

## Start the Tracing Stack

```bash
docker compose -f backend/tracing/docker-compose.jaeger.yml up -d
```

- Jaeger UI: http://localhost:16686
- OTLP HTTP: http://localhost:4318/v1/traces
- OTLP gRPC: localhost:4317

## Enable Tracing

```bash
export TRACING_ENABLED=true
export TRACE_SAMPLE_RATE=0.01 # 1%
export MAX_TRACES_PER_MINUTE=1000
cd backend && pnpm dev
```

## Usage in Code

```typescript
import { traceCreditScore } from './tracing/spans';
import { tracingCorrelationMiddleware } from './tracing/correlation';

await traceCreditScore(config, { userId: '123', modelVersion: 'v1' }, async () => {
  // logic
  return { score: 720, confidence: 0.85, durationMs: 45 };
});
```

## Verify in Jaeger

1. Open http://localhost:16686
2. Service: `chenaikit-backend`
3. Look for `credit_score.calculate`, `fraud_detection.analyze`, `external_api.*`

## Stop the Stack

```bash
docker compose -f backend/tracing/docker-compose.jaeger.yml down