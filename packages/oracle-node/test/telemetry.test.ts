import { describe, expect, it, vi } from "vitest";
import { TelemetryCollector } from "../src/telemetry/metrics.js";
import { RequestContext } from "../src/types.js";

function makeContext(): RequestContext {
  return {
    id: "test-id",
    operationName: "getFeedData",
    method: "GET",
    path: "/api/v1/feeds/ETH-USD",
    url: "http://localhost:8545/api/v1/feeds/ETH-USD",
    isIdempotent: true,
    attempt: 1,
    startTime: Date.now(),
  };
}

describe("TelemetryCollector", () => {
  it("tracks metrics across request lifecycle", () => {
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onRetry = vi.fn();

    const collector = new TelemetryCollector({
      onRequestStart: onStart,
      onRequestSuccess: onSuccess,
      onRequestError: onError,
      onRequestRetry: onRetry,
    });

    const context = makeContext();

    // 1st request succeeds on attempt 1
    collector.onRequestStart({ context, attempt: 1 });
    collector.onRequestSuccess({ context, attempt: 1, durationMs: 120, status: 200 });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // 2nd request fails, retries, then succeeds
    collector.onRequestStart({ context, attempt: 1 });
    collector.onRequestError({ context, attempt: 1, durationMs: 50, error: new Error("drop"), willRetry: true });
    collector.onRequestRetry({ context, attempt: 1, delayMs: 200, error: new Error("drop"), reason: "drop" });
    collector.onRequestStart({ context, attempt: 2 });
    collector.onRequestSuccess({ context, attempt: 2, durationMs: 80, status: 200 });

    const snapshot = collector.getSnapshot();
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.totalAttempts).toBe(3);
    expect(snapshot.successfulRequests).toBe(2);
    expect(snapshot.retriedRequests).toBe(1);
    expect(snapshot.totalRetries).toBe(1);
  });

  it("handles resetting metrics", () => {
    const collector = new TelemetryCollector();
    const context = makeContext();
    collector.onRequestStart({ context, attempt: 1 });
    collector.onRequestSuccess({ context, attempt: 1, durationMs: 100, status: 200 });

    expect(collector.getSnapshot().totalRequests).toBe(1);

    collector.reset();
    expect(collector.getSnapshot().totalRequests).toBe(0);
    expect(collector.getSnapshot().successfulRequests).toBe(0);
  });
});
