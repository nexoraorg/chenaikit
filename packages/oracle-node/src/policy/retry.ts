/**
 * @chenaikit/oracle-node - Retry Policy Engine
 */

import { OracleHttpError, OracleNetworkError, OracleTimeoutError } from "../errors.js";
import { RequestContext, RequestOptions, RetryPolicyOptions } from "../types.js";
import { BackoffCalculator } from "./backoff.js";
import { IdempotencyClassifier } from "./idempotency.js";
import { RateLimitHandler } from "./rate-limit.js";

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Retry Policy governing bounded retries for oracle requests
 */
export class RetryPolicy {
  public readonly maxRetries: number;
  public readonly retryableStatusCodes: Set<number>;
  public readonly retryOnNetworkErrors: boolean;
  public readonly respectRetryAfter: boolean;
  public readonly maxRetryAfterMs: number;
  public readonly backoffCalculator: BackoffCalculator;
  public readonly customShouldRetry?: (
    error: unknown,
    attempt: number,
    context: RequestContext
  ) => boolean | Promise<boolean>;

  constructor(options: RetryPolicyOptions = {}) {
    this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.retryableStatusCodes = new Set(options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES);
    this.retryOnNetworkErrors = options.retryOnNetworkErrors ?? true;
    this.respectRetryAfter = options.respectRetryAfter ?? true;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 30000;
    this.backoffCalculator = new BackoffCalculator(options.backoff);
    this.customShouldRetry = options.shouldRetry;
  }

  /**
   * Determine if an error encountered during an attempt is retryable
   */
  public async isRetryable(
    error: unknown,
    attempt: number,
    context: RequestContext,
    requestOptions?: RequestOptions
  ): Promise<boolean> {
    const maxRetriesForRequest = requestOptions?.maxRetries ?? this.maxRetries;

    // Do not retry if we exceeded max attempts
    if (attempt > maxRetriesForRequest) {
      return false;
    }

    // Safety check: verify idempotency. Never retry non-idempotent operations without key!
    const isSafe = IdempotencyClassifier.isSafeToRetry(context.method, context.operationName, requestOptions);
    if (!isSafe) {
      return false;
    }

    // If caller provided a custom predicate, evaluate it
    if (this.customShouldRetry) {
      try {
        return await this.customShouldRetry(error, attempt, context);
      } catch {
        return false;
      }
    }

    // Check timeout errors (attempt timeouts are retryable for safe operations)
    if (error instanceof OracleTimeoutError) {
      // Total operation timeouts should not be retried
      if (error.isTotalTimeout) {
        return false;
      }
      return true;
    }

    // Check network errors (connection reset, DNS, socket drop)
    if (error instanceof OracleNetworkError) {
      return this.retryOnNetworkErrors;
    }

    // Check HTTP error status codes
    if (error instanceof OracleHttpError) {
      return this.retryableStatusCodes.has(error.status);
    }

    // Check standard JS/Node errors that indicate network drop
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const code = (error as { code?: string }).code;

      if (
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        code === "EAI_AGAIN" ||
        msg.includes("fetch failed") ||
        msg.includes("network error") ||
        msg.includes("connection reset") ||
        msg.includes("socket hang up")
      ) {
        return this.retryOnNetworkErrors;
      }
    }

    return false;
  }

  /**
   * Calculates the delay to wait before the next retry attempt
   */
  public getRetryDelay(
    error: unknown,
    attempt: number,
    previousDelayMs?: number
  ): number {
    // Check if response contains a Retry-After header
    if (this.respectRetryAfter && error instanceof OracleHttpError) {
      const retryAfterMs = RateLimitHandler.parseRetryAfter(error.headers, this.maxRetryAfterMs);
      if (retryAfterMs !== undefined && retryAfterMs > 0) {
        return retryAfterMs;
      }
    }

    return this.backoffCalculator.computeDelay(attempt, previousDelayMs);
  }
}
