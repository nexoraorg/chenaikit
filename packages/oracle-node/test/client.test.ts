import { describe, expect, it } from "vitest";
import {
  OracleCircuitBreakerError,
  OracleClientError,
  OracleHttpError,
  OracleNodeClient,
  OracleRetryExhaustedError,
  OracleTimeoutError,
} from "../src/index.js";
import { MockTransport } from "../src/transport/mock-transport.js";

describe("OracleNodeClient", () => {
  it("throws OracleClientError when baseUrl is missing", () => {
    expect(() => new OracleNodeClient({ baseUrl: "" })).toThrowError(OracleClientError);
  });

  it("attaches API key as Bearer token if provided", async () => {
    const mockTransport = new MockTransport([
      { status: 200, data: { status: "healthy", timestamp: Date.now() } },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      apiKey: "secret-oracle-api-key",
      transport: mockTransport,
    });

    await client.getHealth();

    expect(mockTransport.history.length).toBe(1);
    expect(mockTransport.history[0].headers["Authorization"]).toBe("Bearer secret-oracle-api-key");
  });

  it("succeeds on first attempt for standard GET call", async () => {
    const mockTransport = new MockTransport([
      {
        status: 200,
        data: {
          feedId: "BTC-USD",
          symbol: "BTC/USD",
          value: "68000.50",
          decimals: 8,
          timestamp: 1700000000,
          roundId: 42,
        },
      },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
    });

    const feed = await client.getFeedData("BTC-USD");
    expect(feed.symbol).toBe("BTC/USD");
    expect(feed.value).toBe("68000.50");
    expect(mockTransport.history.length).toBe(1);
  });

  it("retries transient 503 errors with exponential backoff and succeeds on 3rd attempt", async () => {
    const mockTransport = new MockTransport([
      { status: 503, statusText: "Service Unavailable" },
      { status: 503, statusText: "Service Unavailable" },
      {
        status: 200,
        data: {
          nodeId: "node-1",
          version: "0.1.0",
          uptimeSeconds: 3600,
          syncState: "synced",
          blockHeight: 12345,
          activeFeedsCount: 10,
          peerCount: 8,
        },
      },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: {
        maxRetries: 3,
        backoff: { initialDelayMs: 10, maxDelayMs: 50, jitter: "none" },
      },
    });

    const status = await client.getNodeStatus();
    expect(status.nodeId).toBe("node-1");
    expect(status.syncState).toBe("synced");
    expect(mockTransport.history.length).toBe(3);

    const metrics = client.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.totalAttempts).toBe(3);
    expect(metrics.retriedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
  });

  it("exhausts retries and throws OracleRetryExhaustedError for continuous 500s", async () => {
    const mockTransport = new MockTransport([
      { status: 500, statusText: "Internal Error" },
      { status: 500, statusText: "Internal Error" },
      { status: 500, statusText: "Internal Error" },
      { status: 500, statusText: "Internal Error" },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: {
        maxRetries: 2,
        backoff: { initialDelayMs: 5, maxDelayMs: 20, jitter: "none" },
      },
    });

    await expect(client.getRegisteredFeeds()).rejects.toThrowError(OracleRetryExhaustedError);
    expect(mockTransport.history.length).toBe(3); // attempt 1 + 2 retries
  });

  it("throws OracleTimeoutError on attempt timeout", async () => {
    const mockTransport = new MockTransport([{ timeout: true }]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: { maxRetries: 0 },
      timeout: { attemptTimeoutMs: 50 },
    });

    await expect(client.getPeers()).rejects.toThrowError(OracleTimeoutError);
  });

  it("does not retry mutating POST calls by default on transient failure", async () => {
    const mockTransport = new MockTransport([
      { status: 503, statusText: "Service Unavailable" },
      { status: 200, data: { accepted: true, roundId: 10, blockHeight: 500, timestamp: 123 } },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: {
        maxRetries: 3,
        backoff: { initialDelayMs: 5, maxDelayMs: 20, jitter: "none" },
      },
    });

    const report = {
      feedId: "ETH-USD",
      roundId: 10,
      value: "3500.00",
      timestamp: Date.now(),
      signature: "0xabc",
      nodeId: "node-1",
    };

    // Should NOT retry mutating call, fails immediately after 1 attempt
    await expect(client.submitReport(report)).rejects.toThrowError(OracleHttpError);
    expect(mockTransport.history.length).toBe(1);
  });

  it("safely retries mutating POST calls when idempotencyKey is supplied", async () => {
    const mockTransport = new MockTransport([
      { status: 503, statusText: "Service Unavailable" },
      { status: 200, data: { accepted: true, roundId: 10, blockHeight: 500, timestamp: 123 } },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: {
        maxRetries: 3,
        backoff: { initialDelayMs: 5, maxDelayMs: 20, jitter: "none" },
      },
    });

    const report = {
      feedId: "ETH-USD",
      roundId: 10,
      value: "3500.00",
      timestamp: Date.now(),
      signature: "0xabc",
      nodeId: "node-1",
    };

    const result = await client.submitReport(report, {
      idempotencyKey: "unique-report-token-999",
    });

    expect(result.accepted).toBe(true);
    expect(mockTransport.history.length).toBe(2);
    expect(mockTransport.history[0].headers["Idempotency-Key"]).toBe("unique-report-token-999");
    expect(mockTransport.history[1].headers["Idempotency-Key"]).toBe("unique-report-token-999");
  });

  it("trips circuit breaker after consecutive failures and fast-fails subsequent calls", async () => {
    const mockTransport = new MockTransport([
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ]);

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
      retry: { maxRetries: 0 },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        cooldownPeriodMs: 10000,
      },
    });

    // 1st failure
    await expect(client.getConfig()).rejects.toThrow();
    expect(client.getCircuitBreakerState()).toBe("closed");

    // 2nd failure -> trips circuit
    await expect(client.getConfig()).rejects.toThrow();
    expect(client.getCircuitBreakerState()).toBe("open");

    // 3rd call -> fast-fails with OracleCircuitBreakerError without hitting transport
    await expect(client.getConfig()).rejects.toThrowError(OracleCircuitBreakerError);
    expect(mockTransport.history.length).toBe(2); // didn't send 3rd request to network
  });

  it("supports all domain methods", async () => {
    const mockTransport = new MockTransport();
    mockTransport.setHandler((req) => {
      if (req.url.includes("/health")) return { status: 200, statusText: "OK", headers: {}, data: { status: "ok", timestamp: 1 } };
      if (req.url.includes("/rounds/latest")) return { status: 200, statusText: "OK", headers: {}, data: { roundId: 99, answer: "100" } };
      if (req.url.includes("/rounds/5")) return { status: 200, statusText: "OK", headers: {}, data: { roundId: 5, answer: "95" } };
      if (req.url.includes("/attestations/att-1")) return { status: 200, statusText: "OK", headers: {}, data: { attestationId: "att-1" } };
      if (req.url.includes("/attestations/sign")) return { status: 200, statusText: "OK", headers: {}, data: { success: true, attestationId: "att-1" } };
      if (req.url.includes("/commit")) return { status: 200, statusText: "OK", headers: {}, data: { accepted: true } };
      if (req.url.includes("/register")) return { status: 200, statusText: "OK", headers: {}, data: { registered: true, nodeId: "node-x" } };
      if (req.url.includes("/data")) return { status: 200, statusText: "OK", headers: {}, data: { receipt: "rcpt-1" } };
      if (req.url.includes("/gossip")) return { status: 200, statusText: "OK", headers: {}, data: { messageId: "msg-1" } };
      if (req.url.includes("/aggregate")) return { status: 200, statusText: "OK", headers: {}, data: { roundId: 10, status: "aggregated" } };
      if (req.url.includes("/metrics")) return { status: 200, statusText: "OK", headers: {}, data: { cpu: 10 } };
      return { status: 200, statusText: "OK", headers: {}, data: {} };
    });

    const client = new OracleNodeClient({
      baseUrl: "https://oracle.test",
      transport: mockTransport,
    });

    expect((await client.getLatestRound("ETH-USD")).roundId).toBe(99);
    expect((await client.getRoundData("ETH-USD", 5)).roundId).toBe(5);
    expect((await client.getAttestation("att-1")).attestationId).toBe("att-1");
    expect((await client.commitPrice("ETH-USD", "3000", 12345, "sig")).accepted).toBe(true);
    expect((await client.signAttestation("ETH-USD", 1, "sig")).success).toBe(true);
    expect((await client.registerNode({ nodeId: "n1", publicKey: "pk", endpoint: "ep", supportedFeeds: [] })).registered).toBe(true);
    expect((await client.postOracleData("ETH-USD", { sample: 1 })).receipt).toBe("rcpt-1");
    expect((await client.broadcastMessage("topic", { data: 1 })).messageId).toBe("msg-1");
    expect((await client.triggerAggregation("ETH-USD", 10)).status).toBe("aggregated");
    expect((await client.queryMetrics()).cpu).toBe(10);
  });
});
