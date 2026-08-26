# Oracle Node Client Resilience Example

This example demonstrates how to integrate and configure the `@chenaikit/oracle-node` resilient client in TypeScript.

## Key Concepts Demonstrated

1. **Transient Fault Recovery**: Automatically retries safe GET operations during temporary network drops or 503 Service Unavailable responses with exponential backoff and jitter.
2. **Safe Mutating Calls**: Shows how to use `idempotencyKey` tokens when calling mutating endpoints like `submitReport` to prevent duplicate transaction submissions.
3. **Telemetry & Observability**: Attaches lifecycle hooks for latency tracking, retry logs, and circuit breaker trip notifications.
4. **Mock Transport**: Shows how to use `MockTransport` to simulate failures and responses deterministically in testing environments.

## Running the Example

```bash
# From workspace root
pnpm --filter @chenaikit/example-oracle-node-client run start
```
