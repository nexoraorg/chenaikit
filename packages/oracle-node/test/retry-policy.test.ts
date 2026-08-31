import { describe, expect, it } from "vitest";
import { OracleHttpError, OracleNetworkError, OracleTimeoutError } from "../src/errors.js";
import { RetryPolicy } from "../src/policy/retry.js";
import { RequestContext } from "../src/types.js";

function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    id: "test-req-1",
    operationName: "getFeedData",
    method: "GET",
    path: "/api/v1/feeds/ETH-USD",
    url: "http://localhost:8545/api/v1/feeds/ETH-USD",
    isIdempotent: true,
    attempt: 1,
    startTime: Date.now(),
    ...overrides,
  };
}

describe("RetryPolicy", () => {
  it("initializes with default options", () => {
    const policy = new RetryPolicy();
    expect(policy.maxRetries).toBe(3);
    expect(policy.retryOnNetworkErrors).toBe(true);
    expect(policy.respectRetryAfter).toBe(true);
    expect(policy.retryableStatusCodes.has(503)).toBe(true);
    expect(policy.retryableStatusCodes.has(429)).toBe(true);
    expect(policy.retryableStatusCodes.has(500)).toBe(true);
    expect(policy.retryableStatusCodes.has(400)).toBe(false);
  });

  it("retries retryable HTTP status codes for safe requests", async () => {
    const policy = new RetryPolicy();
    const context = makeContext();

    const err503 = new OracleHttpError("Service Unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {},
    });

    const isRetryable = await policy.isRetryable(err503, 1, context);
    expect(isRetryable).toBe(true);
  });

  it("does not retry 4xx client errors (400, 401, 404)", async () => {
    const policy = new RetryPolicy();
    const context = makeContext();

    const err404 = new OracleHttpError("Not Found", {
      status: 404,
      statusText: "Not Found",
      headers: {},
    });

    const err400 = new OracleHttpError("Bad Request", {
      status: 400,
      statusText: "Bad Request",
      headers: {},
    });

    expect(await policy.isRetryable(err404, 1, context)).toBe(false);
    expect(await policy.isRetryable(err400, 1, context)).toBe(false);
  });

  it("retries attempt timeouts for safe requests", async () => {
    const policy = new RetryPolicy();
    const context = makeContext();

    const timeoutErr = new OracleTimeoutError("Attempt timeout", {
      timeoutMs: 1000,
      isTotalTimeout: false,
    });

    expect(await policy.isRetryable(timeoutErr, 1, context)).toBe(true);
  });

  it("does not retry total cumulative timeouts", async () => {
    const policy = new RetryPolicy();
    const context = makeContext();

    const totalTimeoutErr = new OracleTimeoutError("Total timeout", {
      timeoutMs: 5000,
      isTotalTimeout: true,
    });

    expect(await policy.isRetryable(totalTimeoutErr, 1, context)).toBe(false);
  });

  it("retries network errors when retryOnNetworkErrors is true", async () => {
    const policy = new RetryPolicy({ retryOnNetworkErrors: true });
    const context = makeContext();

    const netErr = new OracleNetworkError("Connection refused");
    expect(await policy.isRetryable(netErr, 1, context)).toBe(true);
  });

  it("does not retry when attempt exceeds maxRetries", async () => {
    const policy = new RetryPolicy({ maxRetries: 2 });
    const context = makeContext();

    const err503 = new OracleHttpError("Service Unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {},
    });

    expect(await policy.isRetryable(err503, 1, context)).toBe(true);
    expect(await policy.isRetryable(err503, 2, context)).toBe(true);
    expect(await policy.isRetryable(err503, 3, context)).toBe(false); // attempt > maxRetries
  });

  it("never retries non-idempotent operations without idempotency key", async () => {
    const policy = new RetryPolicy();
    const mutatingContext = makeContext({
      method: "POST",
      operationName: "submitReport",
      isIdempotent: false,
    });

    const err503 = new OracleHttpError("Service Unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {},
    });

    expect(await policy.isRetryable(err503, 1, mutatingContext)).toBe(false);
  });

  it("allows retrying non-idempotent operation when idempotencyKey is present", async () => {
    const policy = new RetryPolicy();
    const mutatingContext = makeContext({
      method: "POST",
      operationName: "submitReport",
      isIdempotent: true,
      idempotencyKey: "test-idem-key",
    });

    const err503 = new OracleHttpError("Service Unavailable", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {},
    });

    expect(
      await policy.isRetryable(err503, 1, mutatingContext, {
        idempotencyKey: "test-idem-key",
      })
    ).toBe(true);
  });

  it("uses Retry-After header delay when available", () => {
    const policy = new RetryPolicy();

    const err429 = new OracleHttpError("Too Many Requests", {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "retry-after": "5" },
    });

    const delay = policy.getRetryDelay(err429, 1);
    expect(delay).toBe(5000);
  });

  it("supports custom shouldRetry predicate", async () => {
    const policy = new RetryPolicy({
      shouldRetry: (error) => {
        if (error instanceof OracleHttpError && error.status === 418) {
          return true; // I'm a teapot retry
        }
        return false;
      },
    });

    const context = makeContext();
    const teapotErr = new OracleHttpError("Teapot", {
      status: 418,
      statusText: "Teapot",
      headers: {},
    });
    const serverErr = new OracleHttpError("Server error", {
      status: 500,
      statusText: "Server error",
      headers: {},
    });

    expect(await policy.isRetryable(teapotErr, 1, context)).toBe(true);
    expect(await policy.isRetryable(serverErr, 1, context)).toBe(false);
  });
});
