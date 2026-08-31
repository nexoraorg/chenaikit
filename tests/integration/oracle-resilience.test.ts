import { describe, expect, it } from "vitest";
import {
  CircuitBreaker,
  MockTransport,
  OracleCircuitBreakerError,
  OracleHttpError,
  OracleNodeClient,
  OracleRetryExhaustedError,
  OracleTimeoutError,
} from "@chenaikit/oracle-node";

describe("Oracle Node Client - Resilience Integration Tests", () => {
  it("integrates bounded retries with realistic network faults and recovered responses", async () => {
    const mock = new MockTransport();

    // Simulate real-world network turbulence:
    // 1. Connection dropped (socket hangup)
    // 2. HTTP 429 Too Many Requests (Rate limit with 10ms wait)
    // 3. HTTP 503 Service Unavailable (temporary node reboot)
    // 4. HTTP 200 OK (recovered response)
    mock.enqueueSequence([
      { error: new Error("fetch failed: socket hang up") },
      { status: 429, headers: { "retry-after": "1" } },
      { status: 503, statusText: "Service Unavailable" },
      {
        status: 200,
        data: {
          feedId: "BTC-USD",
          symbol: "BTC/USD",
          value: "67500.00",
          decimals: 8,
          timestamp: 1700000000,
          roundId: 500,
        },
      },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "http://oracle-cluster.internal",
      transport: mock,
      retry: {
        maxRetries: 4,
        backoff: { initialDelayMs: 5, maxDelayMs: 25, jitter: "none" },
        respectRetryAfter: false, // keep fast for test
      },
      timeout: {
        attemptTimeoutMs: 500,
      },
    });

    const feed = await client.getFeedData("BTC-USD");
    expect(feed.symbol).toBe("BTC/USD");
    expect(feed.value).toBe("67500.00");
    expect(mock.history.length).toBe(4);

    const metrics = client.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.totalAttempts).toBe(4);
    expect(metrics.retriedRequests).toBe(1);
    expect(metrics.totalRetries).toBe(3);
    expect(metrics.successfulRequests).toBe(1);
  });

  it("prevents double-spending / duplicate report submission on network failures without idempotency key", async () => {
    const mock = new MockTransport();
    mock.enqueueSequence([
      { status: 503, statusText: "Service Unavailable" },
      { status: 200, data: { accepted: true, roundId: 100, blockHeight: 1000, timestamp: 1 } },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "http://oracle-cluster.internal",
      transport: mock,
      retry: { maxRetries: 3 },
    });

    const report = {
      feedId: "ETH-USD",
      roundId: 100,
      value: "3500.00",
      timestamp: Date.now(),
      signature: "0x1234",
      nodeId: "validator-1",
    };

    // Unsafe non-idempotent operation should FAIL immediately and NOT retry
    await expect(client.submitReport(report)).rejects.toThrowError(OracleHttpError);
    expect(mock.history.length).toBe(1);
  });

  it("handles circuit breaker trips during catastrophic oracle outages", async () => {
    const mock = new MockTransport();
    mock.enqueueSequence([
      { status: 500, statusText: "Internal Error" },
      { status: 500, statusText: "Internal Error" },
      { status: 500, statusText: "Internal Error" },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "http://oracle-cluster.internal",
      transport: mock,
      retry: { maxRetries: 0 },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        cooldownPeriodMs: 5000,
      },
    });

    // 1st request fails
    await expect(client.getHealth()).rejects.toThrow();
    // 2nd request fails -> Trips breaker
    await expect(client.getHealth()).rejects.toThrow();
    expect(client.getCircuitBreakerState()).toBe("open");

    // Subsequent call should fast fail
    await expect(client.getHealth()).rejects.toThrowError(OracleCircuitBreakerError);
    expect(mock.history.length).toBe(2);
  });
});
