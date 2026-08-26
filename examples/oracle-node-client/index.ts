/**
 * Example: Resilient Oracle Node Client Usage
 *
 * Demonstrates retry policies, timeout configurations, idempotency tokens,
 * and telemetry event hooks.
 */

import {
  MockTransport,
  OracleCircuitBreakerError,
  OracleNodeClient,
  OracleRetryExhaustedError,
  OracleTimeoutError,
} from "@chenaikit/oracle-node";

async function main() {
  console.log("=== Chenaikit Oracle Node Client Demo ===\n");

  // 1. Initialize MockTransport with fault injection sequence:
  //    - First call fails with 503 (transient server overload)
  //    - Second call fails with 503
  //    - Third call succeeds with 200 OK and price data
  const mockTransport = new MockTransport([
    { status: 503, statusText: "Service Unavailable" },
    { status: 503, statusText: "Service Unavailable" },
    {
      status: 200,
      data: {
        feedId: "ETH-USD",
        symbol: "ETH/USD",
        value: "3485.50",
        decimals: 8,
        timestamp: Math.floor(Date.now() / 1000),
        roundId: 1204,
      },
    },
  ]);

  // 2. Configure the client with bounded exponential retry and timeout policy
  const client = new OracleNodeClient({
    baseUrl: "https://oracle-cluster.internal:8545",
    apiKey: "demo-api-key-xyz",
    transport: mockTransport,
    timeout: {
      attemptTimeoutMs: 2000,
      totalTimeoutMs: 10000,
    },
    retry: {
      maxRetries: 3,
      backoff: {
        initialDelayMs: 100,
        maxDelayMs: 2000,
        factor: 2.0,
        jitter: "full",
      },
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      cooldownPeriodMs: 5000,
    },
    telemetry: {
      onRequestStart: (e) =>
        console.log(`[Telemetry] Starting ${e.context.operationName} (attempt ${e.attempt})`),
      onRequestRetry: (e) =>
        console.warn(`[Telemetry] Retrying ${e.context.operationName} after ${e.delayMs}ms due to: ${e.reason}`),
      onRequestSuccess: (e) =>
        console.log(`[Telemetry] Succeeded ${e.context.operationName} in ${e.durationMs}ms`),
      onRequestError: (e) =>
        console.error(`[Telemetry] Attempt ${e.attempt} failed. willRetry=${e.willRetry}`),
      onCircuitStateChange: (from, to) =>
        console.warn(`[Telemetry] Circuit Breaker changed: ${from} -> ${to}`),
    },
  });

  // 3. Perform a safe read query (automatic retry on transient failures)
  console.log("--- 1. Fetching ETH-USD feed data with automatic retry ---");
  try {
    const feed = await client.getFeedData("ETH-USD");
    console.log(`✅ Success! Received Feed Data:`, feed);
  } catch (err) {
    console.error("❌ Failed:", err);
  }

  // 4. Perform a mutating report submission with Idempotency Key protection
  console.log("\n--- 2. Submitting aggregation report with idempotency key ---");
  mockTransport.enqueueSequence([
    { status: 503, statusText: "Service Unavailable" },
    {
      status: 200,
      data: {
        accepted: true,
        roundId: 1205,
        blockHeight: 987654,
        timestamp: Date.now(),
      },
    },
  ]);

  try {
    const submissionResult = await client.submitReport(
      {
        feedId: "ETH-USD",
        roundId: 1205,
        value: "3490.00",
        timestamp: Date.now(),
        signature: "0xabcdef123456...",
        nodeId: "validator-node-alpha",
      },
      {
        idempotencyKey: "report_ETH-USD_1205_alpha",
      }
    );
    console.log("✅ Report submitted successfully:", submissionResult);
  } catch (err) {
    console.error("❌ Submission failed:", err);
  }

  // 5. Query client telemetry metrics snapshot
  console.log("\n--- 3. Performance & Resilience Metrics Snapshot ---");
  const metrics = client.getMetrics();
  console.log(JSON.stringify(metrics, null, 2));

  console.log("\n=== Demo completed successfully ===");
}

main().catch(console.error);
