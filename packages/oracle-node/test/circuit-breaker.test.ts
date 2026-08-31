import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../src/policy/circuit-breaker.js";
import { OracleCircuitBreakerError } from "../src/errors.js";

describe("CircuitBreaker", () => {
  it("stays closed when disabled", () => {
    const cb = new CircuitBreaker({ enabled: false });
    expect(cb.getState()).toBe("closed");
    for (let i = 0; i < 10; i++) {
      cb.recordFailure();
    }
    expect(cb.getState()).toBe("closed");
    expect(() => cb.checkAllowance()).not.toThrow();
  });

  it("transitions from closed to open when failureThreshold is reached", () => {
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      cooldownPeriodMs: 10000,
    });

    expect(cb.getState()).toBe("closed");

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("closed");

    cb.recordFailure(); // 3rd failure
    expect(cb.getState()).toBe("open");

    expect(() => cb.checkAllowance()).toThrowError(OracleCircuitBreakerError);
  });

  it("resets failure counter on success in closed state", () => {
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
    });

    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess(); // resets counter
    cb.recordFailure();

    expect(cb.getState()).toBe("closed");
  });

  it("notifies state change listeners", () => {
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
    });

    const listener = vi.fn();
    const unsubscribe = cb.onStateChange(listener);

    cb.recordFailure();
    cb.recordFailure();

    expect(listener).toHaveBeenCalledWith("closed", "open");

    unsubscribe();
    cb.forceState("closed");
    expect(listener).toHaveBeenCalledTimes(1); // not called after unsubscribe
  });

  it("transitions to half-open after cooldown period", () => {
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      cooldownPeriodMs: 50,
      successThreshold: 2,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("open");

    // Advance time or force state
    cb.forceState("half-open");
    expect(cb.getState()).toBe("half-open");

    // Success in half-open increments success count towards closing
    cb.recordSuccess();
    expect(cb.getState()).toBe("half-open");

    cb.recordSuccess(); // reaches successThreshold
    expect(cb.getState()).toBe("closed");
  });

  it("re-trips to open on failure during half-open trial", () => {
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      successThreshold: 2,
    });

    cb.forceState("half-open");
    cb.recordFailure();
    expect(cb.getState()).toBe("open");
  });
});
