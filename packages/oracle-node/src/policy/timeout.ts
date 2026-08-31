/**
 * @chenaikit/oracle-node - Timeout Policy & Abort Management
 */

import { OracleTimeoutError } from "../errors.js";
import { TimeoutPolicyOptions } from "../types.js";

export const DEFAULT_ATTEMPT_TIMEOUT_MS = 5000;

export interface TimeoutScope {
  signal: AbortSignal;
  cleanup: () => void;
}

/**
 * Manages request timeouts and AbortSignal coordination
 */
export class TimeoutPolicy {
  public readonly attemptTimeoutMs: number;
  public readonly totalTimeoutMs?: number;

  constructor(options: TimeoutPolicyOptions = {}) {
    this.attemptTimeoutMs = options.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
    this.totalTimeoutMs = options.totalTimeoutMs;
  }

  /**
   * Creates an AbortSignal combined with a timeout and any parent caller signal
   */
  public createAttemptScope(
    timeoutMs: number,
    parentSignal?: AbortSignal,
    metadata?: { operationName?: string; url?: string; attempt?: number }
  ): TimeoutScope {
    const controller = new AbortController();
    let isTimedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onParentAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      controller.abort(parentSignal?.reason);
    };

    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason);
      } else {
        parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }
    }

    if (timeoutMs > 0 && !controller.signal.aborted) {
      timer = setTimeout(() => {
        isTimedOut = true;
        const error = new OracleTimeoutError(
          `Request attempt ${metadata?.attempt ?? 1} timed out after ${timeoutMs}ms${
            metadata?.operationName ? ` (operation: ${metadata.operationName})` : ""
          }`,
          {
            timeoutMs,
            operationName: metadata?.operationName,
            url: metadata?.url,
            attempt: metadata?.attempt ?? 1,
            isTotalTimeout: false,
          }
        );
        controller.abort(error);
      }, timeoutMs);
    }

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (parentSignal) {
        parentSignal.removeEventListener("abort", onParentAbort);
      }
    };

    return {
      signal: controller.signal,
      cleanup,
    };
  }

  /**
   * Execute an async action within a total timeout envelope
   */
  public async executeWithTotalTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    totalTimeoutMs?: number,
    parentSignal?: AbortSignal,
    metadata?: { operationName?: string; url?: string }
  ): Promise<T> {
    const effectiveTotalTimeout = totalTimeoutMs ?? this.totalTimeoutMs;
    if (!effectiveTotalTimeout || effectiveTotalTimeout <= 0) {
      // If no total timeout, just run with parent signal or fallback
      const dummyController = new AbortController();
      const onParentAbort = () => dummyController.abort(parentSignal?.reason);
      if (parentSignal) {
        if (parentSignal.aborted) return Promise.reject(parentSignal.reason);
        parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }
      try {
        return await fn(dummyController.signal);
      } finally {
        if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
      }
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onParentAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      controller.abort(parentSignal?.reason);
    };

    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason);
      } else {
        parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new OracleTimeoutError(
          `Operation timed out after cumulative ${effectiveTotalTimeout}ms${
            metadata?.operationName ? ` (operation: ${metadata.operationName})` : ""
          }`,
          {
            timeoutMs: effectiveTotalTimeout,
            operationName: metadata?.operationName,
            url: metadata?.url,
            attempt: 1,
            isTotalTimeout: true,
          }
        );
        controller.abort(error);
        reject(error);
      }, effectiveTotalTimeout);
    });

    try {
      return await Promise.race([fn(controller.signal), timeoutPromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}
