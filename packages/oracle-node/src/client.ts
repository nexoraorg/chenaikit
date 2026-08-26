/**
 * @chenaikit/oracle-node - Resilient Oracle Node Client
 */

import {
  OracleClientError,
  OracleError,
  OracleHttpError,
  OracleNetworkError,
  OracleRateLimitError,
  OracleRetryExhaustedError,
  OracleTimeoutError,
} from "./errors.js";
import { CircuitBreaker } from "./policy/circuit-breaker.js";
import { IDEMPOTENCY_KEY_HEADER, IdempotencyClassifier } from "./policy/idempotency.js";
import { RetryPolicy } from "./policy/retry.js";
import { TimeoutPolicy } from "./policy/timeout.js";
import { TelemetryCollector } from "./telemetry/metrics.js";
import { FetchTransport } from "./transport/fetch-transport.js";
import { buildUrl, serializeRequestBody } from "./transport/transport.js";
import {
  CircuitState,
  HttpMethod,
  NodeRegistrationPayload,
  OracleAttestation,
  OracleClientOptions,
  OracleFeedData,
  OracleNodeStatus,
  OracleReportResult,
  OracleReportSubmission,
  OracleRoundData,
  RequestContext,
  RequestOptions,
  Transport,
  TransportRequest,
} from "./types.js";
import { mergeHeaders } from "./utils/headers.js";
import { sleep } from "./utils/sleep.js";

/**
 * Enterprise-grade client for connecting to Chenaikit Oracle nodes with bounded retry,
 * timeout policies, and idempotency protection.
 */
export class OracleNodeClient {
  public readonly baseUrl: string;
  public readonly apiKey?: string;
  public readonly retryPolicy: RetryPolicy;
  public readonly timeoutPolicy: TimeoutPolicy;
  public readonly circuitBreaker: CircuitBreaker;
  public readonly transport: Transport;
  public readonly telemetry: TelemetryCollector;
  private defaultHeaders: Record<string, string>;

  constructor(options: OracleClientOptions) {
    if (!options || !options.baseUrl) {
      throw new OracleClientError("baseUrl is required to instantiate OracleNodeClient");
    }

    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.retryPolicy = new RetryPolicy(options.retry);
    this.timeoutPolicy = new TimeoutPolicy(options.timeout);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.transport = options.transport ?? new FetchTransport();
    this.telemetry = new TelemetryCollector(options.telemetry);

    this.defaultHeaders = {
      "User-Agent": "@chenaikit/oracle-node/0.1.0",
      ...(options.headers ?? {}),
    };

    if (this.apiKey) {
      this.defaultHeaders["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Connect circuit breaker state changes to telemetry
    this.circuitBreaker.onStateChange((from, to) => {
      this.telemetry.onCircuitStateChange(from, to);
    });
  }

  /**
   * Execute an arbitrary HTTP request against the Oracle node with complete policy enforcement
   */
  public async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const method: HttpMethod = (options.method ?? "GET").toUpperCase() as HttpMethod;
    const operationName = options.operationName ?? `${method} ${path}`;
    const url = buildUrl(this.baseUrl, path, options.query);

    const idempotencyClassification = IdempotencyClassifier.classify(method, operationName, options);
    const isIdempotent = idempotencyClassification !== "non-idempotent";

    // Setup headers
    const requestHeaders = mergeHeaders(this.defaultHeaders, options.headers);

    // If an idempotency key is specified or generated, inject header
    let idempotencyKey = options.idempotencyKey;
    if (idempotencyKey) {
      requestHeaders[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;
    } else if (requestHeaders[IDEMPOTENCY_KEY_HEADER] || requestHeaders["idempotency-key"]) {
      idempotencyKey = requestHeaders[IDEMPOTENCY_KEY_HEADER] ?? requestHeaders["idempotency-key"];
    }

    const bodyString = serializeRequestBody(options.body);

    const requestContext: RequestContext = {
      id: IdempotencyClassifier.generateIdempotencyKey(),
      operationName,
      method,
      path,
      url,
      isIdempotent,
      attempt: 1,
      startTime: Date.now(),
      idempotencyKey,
    };

    // Execute under Total Timeout envelope
    return await this.timeoutPolicy.executeWithTotalTimeout<T>(
      async (totalSignal) => {
        let attempt = 1;
        let previousDelayMs: number | undefined;
        const recordedErrors: unknown[] = [];
        const maxRetries = options.maxRetries ?? this.retryPolicy.maxRetries;

        while (true) {
          requestContext.attempt = attempt;

          // 1. Check Circuit Breaker
          this.circuitBreaker.checkAllowance();

          // 2. Check cancellation
          if (totalSignal.aborted) {
            throw totalSignal.reason instanceof Error
              ? totalSignal.reason
              : new OracleTimeoutError("Request cancelled or timed out", {
                  timeoutMs: 0,
                  operationName,
                  url,
                  attempt,
                });
          }

          // 3. Setup Attempt Timeout Scope
          const attemptTimeout = options.attemptTimeoutMs ?? this.timeoutPolicy.attemptTimeoutMs;
          const attemptScope = this.timeoutPolicy.createAttemptScope(attemptTimeout, totalSignal, {
            operationName,
            url,
            attempt,
          });

          const transportReq: TransportRequest = {
            url,
            method,
            headers: requestHeaders,
            body: bodyString,
            signal: attemptScope.signal,
            timeoutMs: attemptTimeout,
          };

          const attemptStartTime = Date.now();
          this.telemetry.onRequestStart({ context: requestContext, attempt });

          try {
            const response = await this.transport.send<T>(transportReq);
            attemptScope.cleanup();

            const durationMs = Date.now() - attemptStartTime;
            this.circuitBreaker.recordSuccess();

            this.telemetry.onRequestSuccess({
              context: requestContext,
              attempt,
              durationMs,
              status: response.status,
            });

            return response.data;
          } catch (rawError: unknown) {
            attemptScope.cleanup();
            const durationMs = Date.now() - attemptStartTime;
            recordedErrors.push(rawError);

            // Record rate limits for telemetry
            if (rawError instanceof OracleRateLimitError) {
              this.telemetry.recordRateLimit();
            }

            // Check if error was timeout
            if (rawError instanceof OracleTimeoutError) {
              this.telemetry.onRequestTimeout({
                context: requestContext,
                attempt,
                timeoutMs: attemptTimeout,
                isTotalTimeout: rawError.isTotalTimeout,
              });
            }

            // Check if eligible for retry
            const willRetry = await this.retryPolicy.isRetryable(
              rawError,
              attempt,
              requestContext,
              options
            );

            this.telemetry.onRequestError({
              context: requestContext,
              attempt,
              durationMs,
              error: rawError,
              willRetry,
            });

            if (willRetry && attempt <= maxRetries) {
              this.circuitBreaker.recordFailure();

              const delayMs = this.retryPolicy.getRetryDelay(rawError, attempt, previousDelayMs);
              previousDelayMs = delayMs;

              this.telemetry.onRequestRetry({
                context: requestContext,
                attempt,
                delayMs,
                error: rawError,
                reason: rawError instanceof Error ? rawError.message : String(rawError),
              });

              // Pause before next attempt
              await sleep(delayMs, totalSignal);
              attempt++;
              continue;
            }

            // Cannot or will not retry: trip circuit breaker and terminate
            this.circuitBreaker.recordFailure();

            if (recordedErrors.length > 1) {
              throw new OracleRetryExhaustedError(
                `Oracle request failed after ${recordedErrors.length} attempts: ${
                  rawError instanceof Error ? rawError.message : String(rawError)
                }`,
                {
                  attempts: recordedErrors.length,
                  errors: recordedErrors,
                  totalDurationMs: Date.now() - requestContext.startTime,
                }
              );
            }

            throw rawError;
          }
        }
      },
      options.totalTimeoutMs,
      options.signal,
      { operationName, url }
    );
  }

  // =========================================================================
  // Idempotent / Read-Only Oracle Operations
  // =========================================================================

  /**
   * Ping oracle node health status (Idempotent / Safe)
   */
  public async getHealth(options?: RequestOptions): Promise<{ status: string; timestamp: number }> {
    return this.request<{ status: string; timestamp: number }>("/health", {
      method: "GET",
      operationName: "getHealth",
      ...options,
    });
  }

  /**
   * Fetch current oracle node runtime status (Idempotent / Safe)
   */
  public async getNodeStatus(options?: RequestOptions): Promise<OracleNodeStatus> {
    return this.request<OracleNodeStatus>("/api/v1/status", {
      method: "GET",
      operationName: "getNodeStatus",
      ...options,
    });
  }

  /**
   * Fetch latest price and attestation for a data feed (Idempotent / Safe)
   */
  public async getFeedData(feedId: string, options?: RequestOptions): Promise<OracleFeedData> {
    return this.request<OracleFeedData>(`/api/v1/feeds/${encodeURIComponent(feedId)}`, {
      method: "GET",
      operationName: "getFeedData",
      ...options,
    });
  }

  /**
   * Fetch the latest consensus round for a data feed (Idempotent / Safe)
   */
  public async getLatestRound(feedId: string, options?: RequestOptions): Promise<OracleRoundData> {
    return this.request<OracleRoundData>(`/api/v1/feeds/${encodeURIComponent(feedId)}/rounds/latest`, {
      method: "GET",
      operationName: "getLatestRound",
      ...options,
    });
  }

  /**
   * Fetch a specific consensus round by ID (Idempotent / Safe)
   */
  public async getRoundData(
    feedId: string,
    roundId: number,
    options?: RequestOptions
  ): Promise<OracleRoundData> {
    return this.request<OracleRoundData>(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/rounds/${roundId}`,
      {
        method: "GET",
        operationName: "getRoundData",
        ...options,
      }
    );
  }

  /**
   * Fetch a verified cryptographic attestation (Idempotent / Safe)
   */
  public async getAttestation(attestationId: string, options?: RequestOptions): Promise<OracleAttestation> {
    return this.request<OracleAttestation>(`/api/v1/attestations/${encodeURIComponent(attestationId)}`, {
      method: "GET",
      operationName: "getAttestation",
      ...options,
    });
  }

  /**
   * List all active registered feeds supported by this node (Idempotent / Safe)
   */
  public async getRegisteredFeeds(options?: RequestOptions): Promise<string[]> {
    return this.request<string[]>("/api/v1/feeds", {
      method: "GET",
      operationName: "getRegisteredFeeds",
      ...options,
    });
  }

  /**
   * List peer oracle nodes in the consensus mesh (Idempotent / Safe)
   */
  public async getPeers(options?: RequestOptions): Promise<string[]> {
    return this.request<string[]>("/api/v1/network/peers", {
      method: "GET",
      operationName: "getPeers",
      ...options,
    });
  }

  /**
   * Query node configuration and limits (Idempotent / Safe)
   */
  public async getConfig(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/config", {
      method: "GET",
      operationName: "getConfig",
      ...options,
    });
  }

  /**
   * Query node performance and consensus metrics (Idempotent / Safe)
   */
  public async queryMetrics(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/metrics", {
      method: "GET",
      operationName: "queryMetrics",
      ...options,
    });
  }

  // =========================================================================
  // Mutating / Non-Idempotent Operations (Unsafe without Idempotency Key)
  // =========================================================================

  /**
   * Submit an observation report for an aggregation round (Mutating / Non-Idempotent)
   */
  public async submitReport(
    report: OracleReportSubmission,
    options?: RequestOptions
  ): Promise<OracleReportResult> {
    return this.request<OracleReportResult>("/api/v1/reports", {
      method: "POST",
      operationName: "submitReport",
      body: report,
      ...options,
    });
  }

  /**
   * Commit a feed price observation directly (Mutating / Non-Idempotent)
   */
  public async commitPrice(
    feedId: string,
    value: string,
    timestamp: number,
    signature: string,
    options?: RequestOptions
  ): Promise<OracleReportResult> {
    return this.request<OracleReportResult>(`/api/v1/feeds/${encodeURIComponent(feedId)}/commit`, {
      method: "POST",
      operationName: "commitPrice",
      body: { value, timestamp, signature },
      ...options,
    });
  }

  /**
   * Sign off on an attestation batch (Mutating / Non-Idempotent)
   */
  public async signAttestation(
    feedId: string,
    roundId: number,
    signature: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; attestationId: string }> {
    return this.request<{ success: boolean; attestationId: string }>("/api/v1/attestations/sign", {
      method: "POST",
      operationName: "signAttestation",
      body: { feedId, roundId, signature },
      ...options,
    });
  }

  /**
   * Register a new node identity on the oracle network (Mutating / Non-Idempotent)
   */
  public async registerNode(
    payload: NodeRegistrationPayload,
    options?: RequestOptions
  ): Promise<{ registered: boolean; nodeId: string }> {
    return this.request<{ registered: boolean; nodeId: string }>("/api/v1/network/nodes/register", {
      method: "POST",
      operationName: "registerNode",
      body: payload,
      ...options,
    });
  }

  /**
   * Post raw payload data to feed ingest pipeline (Mutating / Non-Idempotent)
   */
  public async postOracleData(
    feedId: string,
    data: unknown,
    options?: RequestOptions
  ): Promise<{ receipt: string }> {
    return this.request<{ receipt: string }>(`/api/v1/feeds/${encodeURIComponent(feedId)}/data`, {
      method: "POST",
      operationName: "postOracleData",
      body: data,
      ...options,
    });
  }

  /**
   * Broadcast a peer-to-peer message across oracle gossip network (Mutating / Non-Idempotent)
   */
  public async broadcastMessage(
    topic: string,
    message: unknown,
    options?: RequestOptions
  ): Promise<{ messageId: string }> {
    return this.request<{ messageId: string }>("/api/v1/network/gossip", {
      method: "POST",
      operationName: "broadcastMessage",
      body: { topic, message },
      ...options,
    });
  }

  /**
   * Trigger an aggregation cycle for a feed (Mutating / Non-Idempotent)
   */
  public async triggerAggregation(
    feedId: string,
    roundId?: number,
    options?: RequestOptions
  ): Promise<{ roundId: number; status: string }> {
    return this.request<{ roundId: number; status: string }>(
      `/api/v1/feeds/${encodeURIComponent(feedId)}/aggregate`,
      {
        method: "POST",
        operationName: "triggerAggregation",
        body: { roundId },
        ...options,
      }
    );
  }

  // =========================================================================
  // Client Management and Telemetry Helpers
  // =========================================================================

  public getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    this.circuitBreaker.forceState("closed");
  }

  public getMetrics() {
    return this.telemetry.getSnapshot();
  }

  public resetMetrics(): void {
    this.telemetry.reset();
  }
}
