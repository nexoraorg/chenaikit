/**
 * @chenaikit/oracle-node — Oracle Node Runtime & Resilient Client
 *
 * Enterprise-grade client with bounded exponential backoff, timeout enforcement,
 * typed errors, idempotency protection, and circuit breakers.
 */

export const VERSION = "0.1.0";

// Export client
export { OracleNodeClient } from "./client.js";

// Export types & interfaces
export type {
  HttpMethod,
  IdempotencyClassification,
  JitterMode,
  CircuitState,
  BackoffOptions,
  RetryPolicyOptions,
  TimeoutPolicyOptions,
  CircuitBreakerOptions,
  TelemetryHooks,
  OracleClientOptions,
  RequestContext,
  RequestOptions,
  TransportRequest,
  TransportResponse,
  Transport,
  RequestStartEvent,
  RequestSuccessEvent,
  RequestErrorEvent,
  RequestRetryEvent,
  RequestTimeoutEvent,
  OracleNodeStatus,
  OracleFeedData,
  OracleRoundData,
  OracleReportSubmission,
  OracleReportResult,
  OracleAttestation,
  NodeRegistrationPayload,
} from "./types.js";

// Export error classes
export {
  OracleError,
  OracleClientError,
  OracleTimeoutError,
  OracleNetworkError,
  OracleHttpError,
  OracleRateLimitError,
  OracleRetryExhaustedError,
  OracleNonIdempotentError,
  OracleCircuitBreakerError,
} from "./errors.js";

// Export policy classes and utilities
export {
  BackoffCalculator,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_FACTOR,
  DEFAULT_JITTER_MODE,
} from "./policy/backoff.js";

export {
  IdempotencyClassifier,
  SAFE_HTTP_METHODS,
  IDEMPOTENT_HTTP_METHODS,
  SAFE_ORACLE_OPERATIONS,
  MUTATING_ORACLE_OPERATIONS,
  IDEMPOTENCY_KEY_HEADER,
} from "./policy/idempotency.js";

export {
  RetryPolicy,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRYABLE_STATUS_CODES,
} from "./policy/retry.js";

export {
  TimeoutPolicy,
  DEFAULT_ATTEMPT_TIMEOUT_MS,
} from "./policy/timeout.js";
export type { TimeoutScope } from "./policy/timeout.js";

export {
  CircuitBreaker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_COOLDOWN_PERIOD_MS,
  DEFAULT_SUCCESS_THRESHOLD,
} from "./policy/circuit-breaker.js";

export {
  RateLimitHandler,
  DEFAULT_MAX_RETRY_AFTER_MS,
} from "./policy/rate-limit.js";

// Export transports
export { FetchTransport } from "./transport/fetch-transport.js";
export { MockTransport } from "./transport/mock-transport.js";
export type { MockHandler, QueuedMockResponse } from "./transport/mock-transport.js";
export { buildUrl, serializeRequestBody, parseResponseBody } from "./transport/transport.js";

// Export telemetry
export { TelemetryCollector } from "./telemetry/metrics.js";
export type { MetricsSnapshot } from "./telemetry/metrics.js";

// Export utility functions
export { sleep } from "./utils/sleep.js";
export { normalizeHeaders, getHeader, mergeHeaders } from "./utils/headers.js";
