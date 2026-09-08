/**
 * @chenaikit/oracle-node — Oracle Node Runtime & Resilient Client
 *
 * Enterprise-grade client with bounded exponential backoff, timeout enforcement,
 * typed errors, idempotency protection, and circuit breakers.
 */

export const VERSION = "0.1.0";

export { OracleNodeClient } from "./client.js";

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

export { FetchTransport } from "./transport/fetch-transport.js";
export { MockTransport } from "./transport/mock-transport.js";
export type { MockHandler, QueuedMockResponse } from "./transport/mock-transport.js";
export { buildUrl, serializeRequestBody, parseResponseBody } from "./transport/transport.js";

export { TelemetryCollector } from "./telemetry/metrics.js";
export type { MetricsSnapshot } from "./telemetry/metrics.js";

export { sleep } from "./utils/sleep.js";
export { normalizeHeaders, getHeader, mergeHeaders } from "./utils/headers.js";

export { loadConfig } from "./config.js";
export type { OracleNodeConfig } from "./config.js";

export { Logger } from "./logger.js";
export type { LogLevel, LoggerOptions } from "./logger.js";

export { createGracefulShutdown, registerShutdownSignals } from "./lifecycle.js";
export type { ClosableServer, OracleShutdownDeps, ShutdownHandler } from "./lifecycle.js";

export * from "./adapters/index.js";

export { OracleSubmitter } from "./submitter.js";
export type {
  OracleTransactionPayload,
  OracleSubmissionReceipt,
  TxExecutor,
  SubmitterOptions,
} from "./submitter.js";

export { OracleHttpServer } from "./server.js";
export type { ServerOptions } from "./server.js";

export { OracleNodeService } from "./service.js";
export type { OracleServiceOptions } from "./service.js";
