import { describe, expect, it } from "vitest";
import { BackoffCalculator } from "../src/policy/backoff.js";

describe("BackoffCalculator", () => {
  it("uses default options when initialized without params", () => {
    const calc = new BackoffCalculator();
    expect(calc.initialDelayMs).toBe(200);
    expect(calc.maxDelayMs).toBe(5000);
    expect(calc.factor).toBe(2.0);
    expect(calc.jitter).toBe("full");
  });

  it("clamps custom parameters safely", () => {
    const calc = new BackoffCalculator({
      initialDelayMs: 100,
      maxDelayMs: 2000,
      factor: 3.0,
      jitter: "none",
    });
    expect(calc.initialDelayMs).toBe(100);
    expect(calc.maxDelayMs).toBe(2000);
    expect(calc.factor).toBe(3.0);
    expect(calc.jitter).toBe("none");
  });

  it("calculates deterministic exponential backoff when jitter is none", () => {
    const calc = new BackoffCalculator({
      initialDelayMs: 100,
      maxDelayMs: 1000,
      factor: 2.0,
      jitter: "none",
    });

    expect(calc.computeDelay(1)).toBe(100); // 100 * 2^0
    expect(calc.computeDelay(2)).toBe(200); // 100 * 2^1
    expect(calc.computeDelay(3)).toBe(400); // 100 * 2^2
    expect(calc.computeDelay(4)).toBe(800); // 100 * 2^3
    expect(calc.computeDelay(5)).toBe(1000); // capped at maxDelayMs
    expect(calc.computeDelay(10)).toBe(1000); // capped at maxDelayMs
  });

  it("bounds full jitter delay between 0 and exponential ceiling", () => {
    const calc = new BackoffCalculator({
      initialDelayMs: 200,
      maxDelayMs: 1000,
      factor: 2.0,
      jitter: "full",
    });

    for (let i = 0; i < 50; i++) {
      const delay = calc.computeDelay(3); // ceiling is 800
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(800);
    }
  });

  it("bounds equal jitter delay between ceiling/2 and ceiling", () => {
    const calc = new BackoffCalculator({
      initialDelayMs: 200,
      maxDelayMs: 2000,
      factor: 2.0,
      jitter: "equal",
    });

    for (let i = 0; i < 50; i++) {
      const delay = calc.computeDelay(2); // ceiling is 400, min is 200
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(400);
    }
  });

  it("computes decorrelated jitter using previous sleep", () => {
    const calc = new BackoffCalculator({
      initialDelayMs: 100,
      maxDelayMs: 3000,
      jitter: "decorrelated",
    });

    for (let i = 0; i < 50; i++) {
      const delay = calc.computeDelay(2, 500);
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(1500); // 500 * 3
    }
  });
});
