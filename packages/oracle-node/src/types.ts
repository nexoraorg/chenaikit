/**
 * @chenaikit/oracle-node - Core Types and Interfaces
 */

/**
 * HTTP methods supported by the Oracle client
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

/**
 * Classification of an operation's idempotency and safety characteristics
 */
export type IdempotencyClassification = "idempotent" | "non-idempotent" | "read-only-safe";

/**
 * Jitter strategy to avoid thundering herds during retries
 */
export type JitterMode = "full" | "equal" | "decorrelated" | "none";

/**
 * State of the circuit breaker
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Backoff calculation strategy
 */
export interface BackoffOptions {
  /** Initial delay before first retry in milliseconds (default: 200) */
  initialDelayMs?: number;
  /** Maximum delay cap between retries in milliseconds (default: 5000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier factor (default: 2.0) */
  factor?: number;
  /** Jitter mode to apply (default: 'full') */
  jitter?: JitterMode;
}

/**
 * Configuration options for the retry policy
 */
export interface RetryPolicyOptions {
  /** Maximum number of retry attempts for safe/idempotent calls (default: 3) */
  maxRetries?: number;
  /** Backoff configuration */
  backoff?: BackoffOptions;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
  /** Whether to retry on network connection errors (default: true) */
  retryOnNetworkErrors?: boolean;
  /** Whether to respect the HTTP Retry-After header for 429/503 (default: true) */
  respectRetryAfter?: boolean;
  /** Maximum wait time allowed when respecting Retry-After header in ms (default: 30000) */
  maxRetryAfterMs?: number;
  /** Custom predicate to determine if an error should trigger a retry */
  shouldRetry?: (error: unknown, attempt: number, context: RequestContext) => boolean | Promise<boolean>;
}

/**
 * Configuration options for timeouts
 */
export interface TimeoutPolicyOptions {
  /** Timeout per individual HTTP attempt in milliseconds (default: 5000) */
  attemptTimeoutMs?: number;
  /** Total cumulative timeout for an operation including all retries in milliseconds (optional) */
  totalTimeoutMs?: number;
}

/**
 * Configuration options for the circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Whether the circuit breaker is enabled (default: false) */
  enabled?: boolean;
  /** Consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in milliseconds to wait before switching from open to half-open (default: 30000) */
  cooldownPeriodMs?: number;
  /** Number of successful calls in half-open state required to close circuit (default: 2) */
  successThreshold?: number;
}

/**
 * Telemetry and lifecycle event hooks
 */
export interface TelemetryHooks {
  /** Triggered when a request attempt is initiated */
  onRequestStart?: (event: RequestStartEvent) => void;
  /** Triggered when a request succeeds */
  onRequestSuccess?: (event: RequestSuccessEvent) => void;
  /** Triggered when a request attempt fails */
  onRequestError?: (event: RequestErrorEvent) => void;
  /** Triggered before a retry delay is initiated */
  onRequestRetry?: (event: RequestRetryEvent) => void;
  /** Triggered when an attempt or request times out */
  onRequestTimeout?: (event: RequestTimeoutEvent) => void;
  /** Triggered when the circuit breaker changes state */
  onCircuitStateChange?: (previous: CircuitState, current: CircuitState) => void;
}

/**
 * Configuration options for initializing the OracleNodeClient
 */
export interface OracleClientOptions {
  /** Base URL for the oracle node HTTP/REST API (e.g. 'http://localhost:8545' or 'https://oracle.network') */
  baseUrl: string;
  /** Optional API key for authenticating against the oracle node */
  apiKey?: string;
  /** Default request timeout policy */
  timeout?: TimeoutPolicyOptions;
  /** Default retry policy */
  retry?: RetryPolicyOptions;
  /** Optional circuit breaker policy */
  circuitBreaker?: CircuitBreakerOptions;
  /** Custom default HTTP headers */
  headers?: Record<string, string>;
  /** Custom transport implementation (defaults to FetchTransport) */
  transport?: Transport;
  /** Lifecycle and telemetry hooks */
  telemetry?: TelemetryHooks;
}

/**
 * Request execution context passed to hooks and policies
 */
export interface RequestContext {
  id: string;
  operationName: string;
  method: HttpMethod;
  path: string;
  url: string;
  isIdempotent: boolean;
  attempt: number;
  startTime: number;
  idempotencyKey?: string;
}

/**
 * Per-request execution options and overrides
 */
export interface RequestOptions {
  /** Operation identifier for telemetry and classification */
  operationName?: string;
  /** Custom HTTP method (default: 'GET') */
  method?: HttpMethod;
  /** URL query parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body payload */
  body?: unknown;
  /** Custom headers for this request */
  headers?: Record<string, string>;
  /** Per-request attempt timeout override in ms */
  attemptTimeoutMs?: number;
  /** Per-request total timeout override in ms */
  totalTimeoutMs?: number;
  /** Per-request max retries override */
  maxRetries?: number;
  /** Explicitly mark whether this specific call is idempotent */
  isIdempotent?: boolean;
  /** Optional idempotency key (makes non-idempotent operations safe to retry) */
  idempotencyKey?: string;
  /** Custom AbortSignal to allow caller cancellation */
  signal?: AbortSignal;
}

/**
 * Raw Transport Request configuration
 */
export interface TransportRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Raw Transport Response data
 */
export interface TransportResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

/**
 * Transport interface for decoupling network engine
 */
export interface Transport {
  send<T = unknown>(request: TransportRequest): Promise<TransportResponse<T>>;
}

/**
 * Telemetry event payloads
 */
export interface RequestStartEvent {
  context: RequestContext;
  attempt: number;
}

export interface RequestSuccessEvent {
  context: RequestContext;
  attempt: number;
  durationMs: number;
  status: number;
}

export interface RequestErrorEvent {
  context: RequestContext;
  attempt: number;
  durationMs: number;
  error: unknown;
  willRetry: boolean;
}

export interface RequestRetryEvent {
  context: RequestContext;
  attempt: number;
  delayMs: number;
  error: unknown;
  reason: string;
}

export interface RequestTimeoutEvent {
  context: RequestContext;
  attempt: number;
  timeoutMs: number;
  isTotalTimeout: boolean;
}

/**
 * Oracle Domain Models
 */
export interface OracleNodeStatus {
  nodeId: string;
  version: string;
  uptimeSeconds: number;
  syncState: "synced" | "syncing" | "offline";
  blockHeight: number;
  activeFeedsCount: number;
  peerCount: number;
}

export interface OracleFeedData {
  feedId: string;
  symbol: string;
  value: string;
  decimals: number;
  timestamp: number;
  roundId: number;
  signature?: string;
  attestationId?: string;
}

export interface OracleRoundData {
  feedId: string;
  roundId: number;
  answer: string;
  startedAt: number;
  updatedAt: number;
  answeredInRound: number;
  participants: string[];
}

export interface OracleReportSubmission {
  feedId: string;
  roundId: number;
  value: string;
  timestamp: number;
  signature: string;
  nodeId: string;
}

export interface OracleReportResult {
  accepted: boolean;
  txHash?: string;
  roundId: number;
  blockHeight: number;
  timestamp: number;
}

export interface OracleAttestation {
  attestationId: string;
  feedId: string;
  roundId: number;
  merkleRoot: string;
  signatures: Array<{
    nodeId: string;
    signature: string;
    weight: number;
  }>;
  consensusReached: boolean;
  timestamp: number;
}

export interface NodeRegistrationPayload {
  nodeId: string;
  publicKey: string;
  endpoint: string;
  supportedFeeds: string[];
}
