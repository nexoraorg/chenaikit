# @chenaikit/oracle-node

High-performance, fault-tolerant Oracle node client runtime with bounded exponential retries, request timeouts, typed error handling, idempotency protection, and circuit breakers.

## Features

- 🛡️ **Idempotency Classification**: Automatically differentiates between read-only safe requests (`GET`, `HEAD`, `OPTIONS`, feed queries, status checks) and mutating non-idempotent operations (`submitReport`, `commitPrice`, `signAttestation`).
- 🔄 **Bounded Exponential Backoff**: Prevents thundering herds with configurable backoff multipliers, minimum/maximum delay clamps, and jitter algorithms (`full`, `equal`, `decorrelated`, `none`).
- ⏱️ **Granular Timeout Controls**: Configure per-attempt timeouts, cumulative total timeouts, and cancellation via `AbortSignal`.
- 🏷️ **Typed Error Hierarchy**: Clean, structured error types (`OracleTimeoutError`, `OracleHttpError`, `OracleRateLimitError`, `OracleNetworkError`, `OracleRetryExhaustedError`, `OracleCircuitBreakerError`).
- ⚡ **Circuit Breaker**: Detects downstream node degradation, opens the circuit after consecutive failures, and fast-fails requests to prevent cascading node collapse.
- 🚦 **Rate Limit Handling**: Native parsing of HTTP 429 `Retry-After` headers (both integer seconds and RFC 7231 HTTP dates).
- 📊 **Telemetry & Metrics**: Built-in event hooks and performance telemetry for latency tracking, attempt counts, retry rates, and circuit transitions.
- 🧪 **Mock Transport**: Test suite and deterministic simulation tools for integration and unit testing.

---

## Installation

```bash
pnpm add @chenaikit/oracle-node
```

---

## Quick Start

```typescript
import { OracleNodeClient } from "@chenaikit/oracle-node";

const client = new OracleNodeClient({
  baseUrl: "https://oracle.network.internal:8545",
  apiKey: process.env.ORACLE_API_KEY,
  timeout: {
    attemptTimeoutMs: 3000,
    totalTimeoutMs: 10000,
  },
  retry: {
    maxRetries: 3,
    backoff: {
      initialDelayMs: 200,
      maxDelayMs: 4000,
      jitter: "full",
    },
  },
});

// Fetch latest price feed (safe GET call - automatically retried on transient 5xx/network errors)
const feed = await client.getFeedData("BTC-USD");
console.log(`Feed: ${feed.symbol} -> Price: ${feed.value}`);
```

---

## Architecture & Policy Design

### 1. Operation Classification & Idempotency Rules

Network operations are classified into three safety categories:

| Category | HTTP Methods / Operations | Retry Behavior | Idempotency Key Required? |
| :--- | :--- | :--- | :--- |
| `read-only-safe` | `GET`, `HEAD`, `OPTIONS`, `getHealth`, `getNodeStatus`, `getFeedData`, `getLatestRound`, `getRoundData`, `getAttestation`, `getPeers`, `getConfig`, `queryMetrics` | Automatically retried up to `maxRetries` | No |
| `idempotent` | `PUT`, `DELETE`, or any operation where `isIdempotent: true` or `idempotencyKey` is supplied | Automatically retried up to `maxRetries` | Yes (or explicit flag) |
| `non-idempotent` | `POST`, `PATCH`, `submitReport`, `commitPrice`, `signAttestation`, `registerNode`, `postOracleData`, `broadcastMessage`, `triggerAggregation` | **Never retried automatically** on error to prevent duplicate execution | Optional to make safe |

#### Making Mutating Operations Safe to Retry
To safely retry mutating operations, supply an `idempotencyKey`:

```typescript
const result = await client.submitReport(
  {
    feedId: "ETH-USD",
    roundId: 104,
    value: "3489.12",
    timestamp: Date.now(),
    signature: "0x3a4b...",
    nodeId: "node-validator-01",
  },
  {
    idempotencyKey: "report_ETH-USD_round104_validator01",
  }
);
```

---

### 2. Retry Policy Defaults and Overrides

#### Defaults

| Option | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `maxRetries` | `number` | `3` | Maximum number of retry attempts for safe calls |
| `retryableStatusCodes` | `number[]` | `[408, 429, 500, 502, 503, 504]` | HTTP status codes eligible for retry |
| `retryOnNetworkErrors` | `boolean` | `true` | Retry on connection drop, reset, or DNS errors |
| `respectRetryAfter` | `boolean` | `true` | Respect HTTP 429/503 `Retry-After` header value |
| `maxRetryAfterMs` | `number` | `30000` | Maximum cap when waiting for `Retry-After` |
| `backoff.initialDelayMs` | `number` | `200` | Base delay for backoff formula |
| `backoff.maxDelayMs` | `number` | `5000` | Ceiling delay cap |
| `backoff.factor` | `number` | `2.0` | Exponential multiplier |
| `backoff.jitter` | `"full" \| "equal" \| "decorrelated" \| "none"` | `"full"` | Jitter distribution strategy |

#### Custom Retry Predicate

You can supply a custom predicate to control retry logic:

```typescript
const client = new OracleNodeClient({
  baseUrl: "https://oracle.internal",
  retry: {
    maxRetries: 4,
    shouldRetry: (error, attempt, context) => {
      // Custom business logic: only retry GET requests during off-peak hours
      if (context.method !== "GET") return false;
      if (error instanceof OracleHttpError && error.status === 503) return true;
      return false;
    },
  },
});
```

---

### 3. Timeout Policy Configuration

#### Client Configuration
```typescript
const client = new OracleNodeClient({
  baseUrl: "https://oracle.internal",
  timeout: {
    attemptTimeoutMs: 2500, // Per attempt timeout
    totalTimeoutMs: 8000,    // Total cumulative budget across all retries
  },
});
```

#### Per-Request Timeout Override
```typescript
// Override for a single latency-critical query
const quickStatus = await client.getNodeStatus({
  attemptTimeoutMs: 800,
  maxRetries: 1,
});
```

---

### 4. Circuit Breaker Configuration

The circuit breaker prevents hammering failing oracle nodes:

```typescript
const client = new OracleNodeClient({
  baseUrl: "https://oracle.internal",
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,     // Trip to OPEN after 5 consecutive failures
    cooldownPeriodMs: 30000, // Wait 30s before trying HALF-OPEN trial
    successThreshold: 2,     // 2 successful trial calls close the circuit
  },
});
```

---

### 5. Typed Error Hierarchy

```typescript
import {
  OracleError,              // Base class
  OracleTimeoutError,       // Thrown when attempt or total timeout triggers
  OracleHttpError,          // Thrown on 4xx/5xx responses
  OracleRateLimitError,     // Thrown on 429 with retryAfterMs
  OracleNetworkError,       // Thrown on TCP/DNS connection drops
  OracleRetryExhaustedError,// Thrown when all attempts fail
  OracleCircuitBreakerError // Thrown when circuit breaker is OPEN
} from "@chenaikit/oracle-node";

try {
  await client.getFeedData("SOL-USD");
} catch (err) {
  if (err instanceof OracleTimeoutError) {
    console.error(`Timeout after ${err.timeoutMs}ms on attempt ${err.attempt}`);
  } else if (err instanceof OracleRateLimitError) {
    console.error(`Rate limited. Recommended wait: ${err.retryAfterMs}ms`);
  } else if (err instanceof OracleRetryExhaustedError) {
    console.error(`Exhausted ${err.attempts} attempts. Last error:`, err.lastError);
  } else if (err instanceof OracleCircuitBreakerError) {
    console.warn(`Circuit breaker OPEN. Fast-failing for next ${err.cooldownRemainingMs}ms`);
  }
}
```

---

### 6. Observability & Telemetry

```typescript
const client = new OracleNodeClient({
  baseUrl: "https://oracle.internal",
  telemetry: {
    onRequestStart: (e) => console.log(`[Start] ${e.context.operationName} attempt ${e.attempt}`),
    onRequestSuccess: (e) => console.log(`[Success] ${e.context.operationName} in ${e.durationMs}ms`),
    onRequestRetry: (e) => console.warn(`[Retry] attempt ${e.attempt}, waiting ${e.delayMs}ms due to:`, e.reason),
    onRequestTimeout: (e) => console.error(`[Timeout] ${e.context.operationName} timed out`),
    onCircuitStateChange: (from, to) => console.warn(`[Circuit] transitioned from ${from} to ${to}`),
  },
});

// Retrieve aggregated metrics snapshot
const snapshot = client.getMetrics();
console.log(snapshot);
```

---

## API Reference

### Read-Only / Idempotent Methods
- `client.getHealth(options?)`
- `client.getNodeStatus(options?)`
- `client.getFeedData(feedId, options?)`
- `client.getLatestRound(feedId, options?)`
- `client.getRoundData(feedId, roundId, options?)`
- `client.getAttestation(attestationId, options?)`
- `client.getRegisteredFeeds(options?)`
- `client.getPeers(options?)`
- `client.getConfig(options?)`
- `client.queryMetrics(options?)`

### Mutating Operations
- `client.submitReport(report, options?)`
- `client.commitPrice(feedId, value, timestamp, signature, options?)`
- `client.signAttestation(feedId, roundId, signature, options?)`
- `client.registerNode(payload, options?)`
- `client.postOracleData(feedId, data, options?)`
- `client.broadcastMessage(topic, message, options?)`
- `client.triggerAggregation(feedId, roundId?, options?)`

### Generic Execution
- `client.request<T>(path, options?)`

---

## License

MIT
