import { describe, expect, it } from "vitest";
import { OracleTimeoutError } from "../src/errors.js";
import { TimeoutPolicy } from "../src/policy/timeout.js";
import { sleep } from "../src/utils/sleep.js";

describe("TimeoutPolicy", () => {
  it("initializes with default options", () => {
    const policy = new TimeoutPolicy();
    expect(policy.attemptTimeoutMs).toBe(5000);
    expect(policy.totalTimeoutMs).toBeUndefined();
  });

  it("aborts attempt scope when timeout expires", async () => {
    const policy = new TimeoutPolicy();
    const scope = policy.createAttemptScope(50, undefined, {
      operationName: "getFeedData",
      url: "http://localhost:8545/feed",
      attempt: 1,
    });

    expect(scope.signal.aborted).toBe(false);

    await sleep(70);

    expect(scope.signal.aborted).toBe(true);
    expect(scope.signal.reason).toBeInstanceOf(OracleTimeoutError);
    const timeoutErr = scope.signal.reason as OracleTimeoutError;
    expect(timeoutErr.timeoutMs).toBe(50);
    expect(timeoutErr.operationName).toBe("getFeedData");
    expect(timeoutErr.attempt).toBe(1);
    expect(timeoutErr.isTotalTimeout).toBe(false);

    scope.cleanup();
  });

  it("propagates parent abort signal to attempt scope", () => {
    const policy = new TimeoutPolicy();
    const parentController = new AbortController();
    const scope = policy.createAttemptScope(1000, parentController.signal);

    expect(scope.signal.aborted).toBe(false);

    parentController.abort(new Error("caller cancelled"));

    expect(scope.signal.aborted).toBe(true);
    expect((scope.signal.reason as Error).message).toBe("caller cancelled");

    scope.cleanup();
  });

  it("cleans up timer properly when scope is cleaned up before timeout", async () => {
    const policy = new TimeoutPolicy();
    const scope = policy.createAttemptScope(100);

    scope.cleanup();
    await sleep(150);

    // After cleanup, the timer was cancelled so it should not have aborted the controller
    expect(scope.signal.aborted).toBe(false);
  });

  it("enforces total timeout envelope", async () => {
    const policy = new TimeoutPolicy({ totalTimeoutMs: 50 });

    await expect(
      policy.executeWithTotalTimeout(
        async () => {
          await sleep(100);
          return "success";
        },
        50,
        undefined,
        { operationName: "longTask" }
      )
    ).rejects.toThrowError(OracleTimeoutError);
  });

  it("allows execution within total timeout to succeed", async () => {
    const policy = new TimeoutPolicy({ totalTimeoutMs: 200 });

    const result = await policy.executeWithTotalTimeout(async () => {
      await sleep(20);
      return "completed";
    });

    expect(result).toBe("completed");
  });
});
