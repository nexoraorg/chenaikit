import { describe, expect, it } from "vitest";
import { RateLimitHandler } from "../src/policy/rate-limit.js";

describe("RateLimitHandler", () => {
  it("returns undefined when header is missing", () => {
    expect(RateLimitHandler.parseRetryAfter(undefined)).toBeUndefined();
    expect(RateLimitHandler.parseRetryAfter({})).toBeUndefined();
  });

  it("parses integer seconds correctly", () => {
    const delay = RateLimitHandler.parseRetryAfter({ "retry-after": "10" });
    expect(delay).toBe(10000);
  });

  it("parses case-insensitive header keys", () => {
    const delay = RateLimitHandler.parseRetryAfter({ "Retry-After": "5" });
    expect(delay).toBe(5000);
  });

  it("clamps to maxAllowedMs if Retry-After exceeds cap", () => {
    const delay = RateLimitHandler.parseRetryAfter({ "retry-after": "120" }, 30000);
    expect(delay).toBe(30000);
  });

  it("parses HTTP-Date format", () => {
    const futureDate = new Date(Date.now() + 15000).toUTCString();
    const delay = RateLimitHandler.parseRetryAfter({ "retry-after": futureDate });
    expect(delay).toBeDefined();
    expect(delay).toBeGreaterThanOrEqual(10000);
    expect(delay).toBeLessThanOrEqual(20000);
  });

  it("returns 0 for past HTTP-Date", () => {
    const pastDate = new Date(Date.now() - 5000).toUTCString();
    const delay = RateLimitHandler.parseRetryAfter({ "retry-after": pastDate });
    expect(delay).toBe(0);
  });
});
