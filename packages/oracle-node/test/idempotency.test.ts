import { describe, expect, it } from "vitest";
import { IdempotencyClassifier } from "../src/policy/idempotency.js";

describe("IdempotencyClassifier", () => {
  it("classifies GET, HEAD, and OPTIONS as read-only safe", () => {
    expect(IdempotencyClassifier.classify("GET")).toBe("read-only-safe");
    expect(IdempotencyClassifier.classify("HEAD")).toBe("read-only-safe");
    expect(IdempotencyClassifier.classify("OPTIONS")).toBe("read-only-safe");

    expect(IdempotencyClassifier.isSafeToRetry("GET")).toBe(true);
    expect(IdempotencyClassifier.isSafeToRetry("HEAD")).toBe(true);
    expect(IdempotencyClassifier.isSafeToRetry("OPTIONS")).toBe(true);
  });

  it("classifies PUT and DELETE as idempotent", () => {
    expect(IdempotencyClassifier.classify("PUT")).toBe("idempotent");
    expect(IdempotencyClassifier.classify("DELETE")).toBe("idempotent");

    expect(IdempotencyClassifier.isSafeToRetry("PUT")).toBe(true);
    expect(IdempotencyClassifier.isSafeToRetry("DELETE")).toBe(true);
  });

  it("classifies POST and PATCH as non-idempotent by default", () => {
    expect(IdempotencyClassifier.classify("POST")).toBe("non-idempotent");
    expect(IdempotencyClassifier.classify("PATCH")).toBe("non-idempotent");

    expect(IdempotencyClassifier.isSafeToRetry("POST")).toBe(false);
    expect(IdempotencyClassifier.isSafeToRetry("PATCH")).toBe(false);
  });

  it("recognizes known safe oracle operation names", () => {
    expect(IdempotencyClassifier.classify("POST", "getFeedData")).toBe("read-only-safe");
    expect(IdempotencyClassifier.classify("POST", "getNodeStatus")).toBe("read-only-safe");
    expect(IdempotencyClassifier.classify("POST", "getLatestRound")).toBe("read-only-safe");
    expect(IdempotencyClassifier.isSafeToRetry("POST", "getFeedData")).toBe(true);
  });

  it("recognizes known mutating oracle operation names", () => {
    expect(IdempotencyClassifier.classify("POST", "submitReport")).toBe("non-idempotent");
    expect(IdempotencyClassifier.classify("POST", "commitPrice")).toBe("non-idempotent");
    expect(IdempotencyClassifier.classify("POST", "signAttestation")).toBe("non-idempotent");
    expect(IdempotencyClassifier.isSafeToRetry("POST", "submitReport")).toBe(false);
  });

  it("promotes non-idempotent operations to idempotent when idempotencyKey is supplied", () => {
    expect(
      IdempotencyClassifier.classify("POST", "submitReport", {
        idempotencyKey: "test-idem-key-123",
      })
    ).toBe("idempotent");

    expect(
      IdempotencyClassifier.isSafeToRetry("POST", "submitReport", {
        idempotencyKey: "test-idem-key-123",
      })
    ).toBe(true);
  });

  it("promotes non-idempotent operations to idempotent when Idempotency-Key header is present", () => {
    expect(
      IdempotencyClassifier.classify("POST", "submitReport", {
        headers: { "Idempotency-Key": "header-key-abc" },
      })
    ).toBe("idempotent");

    expect(
      IdempotencyClassifier.isSafeToRetry("POST", "submitReport", {
        headers: { "idempotency-key": "header-key-abc" },
      })
    ).toBe(true);
  });

  it("respects explicit isIdempotent override", () => {
    expect(
      IdempotencyClassifier.classify("POST", "submitReport", {
        isIdempotent: true,
      })
    ).toBe("idempotent");

    expect(
      IdempotencyClassifier.classify("GET", "getFeedData", {
        isIdempotent: false,
      })
    ).toBe("non-idempotent");
  });

  it("generates unique idempotency tokens", () => {
    const key1 = IdempotencyClassifier.generateIdempotencyKey();
    const key2 = IdempotencyClassifier.generateIdempotencyKey();
    expect(key1).toMatch(/^idem_/);
    expect(key2).toMatch(/^idem_/);
    expect(key1).not.toBe(key2);
  });
});
