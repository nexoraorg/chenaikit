import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  VERSION,
  createApiErrorPayload,
  isApiErrorPayload,
  normalizeClientError,
  toUnknownApiErrorPayload,
} from "../src/index.js";

describe("core package", () => {
  it("exports package version and types", () => {
    expect(VERSION).toBe("0.1.0");
    expect(API_ERROR_CODES).toContain("validation_error");
    expect(API_ERROR_CODES).toContain("internal_error");
  });

  it("creates a JSON-serializable API error payload and strips sensitive detail keys", () => {
    const payload = createApiErrorPayload({
      error: "validation_error",
      message: "Invalid input field.",
      statusCode: 400,
      requestId: "req-123",
      retryAfter: 5,
      details: {
        field: "amount",
        stack: "Error: secret stack trace",
        password: "secret",
        undefinedField: undefined,
      },
    });

    const roundTrip = JSON.parse(JSON.stringify(payload));
    expect(isApiErrorPayload(roundTrip)).toBe(true);
    expect(roundTrip).toEqual({
      error: "validation_error",
      message: "Invalid input field.",
      statusCode: 400,
      requestId: "req-123",
      retryAfter: 5,
      details: { field: "amount" },
    });
  });

  it("narrows valid API error payloads and rejects malformed shapes", () => {
    expect(
      isApiErrorPayload({
        error: "not_found",
        message: "Resource not found.",
      }),
    ).toBe(true);

    expect(isApiErrorPayload(null)).toBe(false);
    expect(isApiErrorPayload({ error: "", message: "missing code" })).toBe(false);
    expect(isApiErrorPayload({ error: "not_found" })).toBe(false);
    expect(isApiErrorPayload({ error: "not_found", message: "ok", statusCode: "404" })).toBe(false);
  });

  it("converts unknown errors into safe fallback payloads without leaking internals", () => {
    const rawError = new Error("SELECT * FROM users WHERE secret_token = 'abc'");
    const payload = toUnknownApiErrorPayload(rawError, { requestId: "req-500" });

    expect(payload).toEqual({
      error: "internal_error",
      message: DEFAULT_INTERNAL_ERROR_MESSAGE,
      requestId: "req-500",
    });
    expect(JSON.stringify(payload)).not.toContain("SELECT * FROM users");
    expect(JSON.stringify(payload)).not.toContain("stack");
  });

  it("normalizes client errors safely across structured payloads and Error instances", () => {
    const wrapped = new Error("raw transport failure", {
      cause: {
        error: "rate_limit_exceeded",
        message: "Too many requests, please slow down.",
        requestId: "req-429",
        retryAfter: 30,
      },
    });

    expect(normalizeClientError(wrapped)).toEqual({
      error: "rate_limit_exceeded",
      message: "Too many requests, please slow down.",
      requestId: "req-429",
      retryAfter: 30,
    });

    const unexpected = new Error("internal stack details");
    expect(
      normalizeClientError(unexpected, {
        exposeErrorMessage: false,
        fallbackMessage: "Safe production fallback.",
      }),
    ).toEqual({
      error: "unknown_error",
      message: "Safe production fallback.",
    });

    expect(
      normalizeClientError(unexpected, {
        exposeErrorMessage: true,
        fallbackMessage: "Safe production fallback.",
      }),
    ).toEqual({
      error: "unknown_error",
      message: "internal stack details",
    });
  });
});
