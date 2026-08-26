/**
 * @chenaikit/oracle-node - Bounded Backoff Algorithms
 */

import { BackoffOptions, JitterMode } from "../types.js";

export const DEFAULT_INITIAL_DELAY_MS = 200;
export const DEFAULT_MAX_DELAY_MS = 5000;
export const DEFAULT_FACTOR = 2.0;
export const DEFAULT_JITTER_MODE: JitterMode = "full";

/**
 * Calculates backoff delay with jitter and bound clamping
 */
export class BackoffCalculator {
  public readonly initialDelayMs: number;
  public readonly maxDelayMs: number;
  public readonly factor: number;
  public readonly jitter: JitterMode;

  constructor(options: BackoffOptions = {}) {
    this.initialDelayMs = Math.max(1, options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS);
    this.maxDelayMs = Math.max(this.initialDelayMs, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
    this.factor = Math.max(1, options.factor ?? DEFAULT_FACTOR);
    this.jitter = options.jitter ?? DEFAULT_JITTER_MODE;
  }

  /**
   * Compute backoff duration for a given 1-indexed attempt number
   *
   * @param attempt Current attempt number (1 for first retry after failure)
   * @param previousDelayMs Optional previous delay for decorrelated jitter
   * @returns Bounded delay duration in milliseconds
   */
  public computeDelay(attempt: number, previousDelayMs?: number): number {
    const safeAttempt = Math.max(1, attempt);
    // Exponential formula: base * (factor ^ (attempt - 1))
    const rawExponential = this.initialDelayMs * Math.pow(this.factor, safeAttempt - 1);
    const ceiling = Math.min(this.maxDelayMs, rawExponential);

    let calculatedDelay: number;

    switch (this.jitter) {
      case "full": {
        // AWS Full Jitter: Sleep = rand(0, min(maxDelay, base * 2^attempt))
        calculatedDelay = Math.random() * ceiling;
        break;
      }

      case "equal": {
        // Equal Jitter: Sleep = (ceiling / 2) + rand(0, ceiling / 2)
        const half = ceiling / 2;
        calculatedDelay = half + Math.random() * half;
        break;
      }

      case "decorrelated": {
        // Decorrelated Jitter: Sleep = min(maxDelay, rand(base, prevSleep * 3))
        const prev = previousDelayMs !== undefined ? previousDelayMs : this.initialDelayMs;
        const low = this.initialDelayMs;
        const high = Math.max(low, prev * 3);
        calculatedDelay = low + Math.random() * (high - low);
        calculatedDelay = Math.min(this.maxDelayMs, calculatedDelay);
        break;
      }

      case "none":
      default: {
        calculatedDelay = ceiling;
        break;
      }
    }

    // Clamp between initial delay (or 0 for full jitter) and max delay
    const minBound = this.jitter === "full" ? 0 : this.initialDelayMs;
    const clamped = Math.min(this.maxDelayMs, Math.max(minBound, Math.round(calculatedDelay)));
    return clamped;
  }
}
