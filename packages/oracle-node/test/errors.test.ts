import { describe, expect, it } from "vitest";
import {
  OracleCircuitBreakerError,
  OracleClientError,
  OracleError,
  OracleHttpError,
  OracleNetworkError,
  OracleNonIdempotentError,
  OracleRateLimitError,
  OracleRetryExhaustedError,
  OracleTimeoutError,
} from "../src/errors.js";

describe("Typed Error Hierarchy", () => {
  it("creates OracleError with code and timestamp", () => {
    const err = new OracleError("base error", "CUSTOM_CODE");
    expect(err.message).toBe("base error");
    expect(err.code).toBe("CUSTOM_CODE");
    expect(err.timestamp).toBeTypeOf("number");
    expect(err.toJSON()).toMatchObject({
      name: "OracleError",
      message: "base error",
      code: "CUSTOM_CODE",
    });
  });

  it("creates OracleTimeoutError with metadata", () => {
    const err = new OracleTimeoutError("Attempt timed out", {
      timeoutMs: 5000,
      operationName: "getFeedData",
      url: "http://localhost:8545/feed",
      attempt: 2,
      isTotalTimeout: false,
    });

    expect(err.timeoutMs).toBe(5000);
    expect(err.operationName).toBe("getFeedData");
    expect(err.url).toBe("http://localhost:8545/feed");
    expect(err.attempt).toBe(2);
    expect(err.isTotalTimeout).toBe(false);
    expect(err.code).toBe("ORACLE_TIMEOUT_ERROR");
  });

  it("creates OracleHttpError and OracleRateLimitError with status and response body", () => {
    const httpErr = new OracleHttpError("Not Found", {
      status: 404,
      statusText: "Not Found",
      headers: { "x-req-id": "123" },
      responseBody: { error: "resource missing" },
    });

    expect(httpErr.status).toBe(404);
    expect(httpErr.responseBody).toEqual({ error: "resource missing" });
    expect(httpErr.code).toBe("ORACLE_HTTP_404");

    const rateErr = new OracleRateLimitError("Rate limit exceeded", {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "retry-after": "10" },
      retryAfterMs: 10000,
    });

    expect(rateErr.status).toBe(429);
    expect(rateErr.retryAfterMs).toBe(10000);
    expect(rateErr.code).toBe("ORACLE_RATE_LIMIT_ERROR");
  });

  it("creates OracleRetryExhaustedError with full chain of attempt errors", () => {
    const err1 = new OracleHttpError("503", { status: 503, statusText: "Unavailable", headers: {} });
    const err2 = new OracleHttpError("503", { status: 503, statusText: "Unavailable", headers: {} });
    const err3 = new OracleNetworkError("Connection reset");

    const exhaustedErr = new OracleRetryExhaustedError("All retries failed", {
      attempts: 3,
      errors: [err1, err2, err3],
      totalDurationMs: 1250,
    });

    expect(exhaustedErr.attempts).toBe(3);
    expect(exhaustedErr.errors.length).toBe(3);
    expect(exhaustedErr.lastError).toBe(err3);
    expect(exhaustedErr.totalDurationMs).toBe(1250);
  });

  it("creates OracleNonIdempotentError and OracleCircuitBreakerError", () => {
    const nonIdemErr = new OracleNonIdempotentError("Cannot retry mutating call", {
      operationName: "submitReport",
      method: "POST",
    });
    expect(nonIdemErr.operationName).toBe("submitReport");
    expect(nonIdemErr.method).toBe("POST");

    const cbErr = new OracleCircuitBreakerError("Circuit open", 15000);
    expect(cbErr.cooldownRemainingMs).toBe(15000);
  });
});
