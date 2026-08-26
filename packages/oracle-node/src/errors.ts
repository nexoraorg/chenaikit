/**
 * @chenaikit/oracle-node - Typed Error Hierarchy
 */

/**
 * Base error class for all Oracle node client errors
 */
export class OracleError extends Error {
  public readonly code: string;
  public readonly timestamp: number;

  constructor(message: string, code = "ORACLE_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Thrown when client configuration or parameters are invalid
 */
export class OracleClientError extends OracleError {
  constructor(message: string, code = "ORACLE_CLIENT_ERROR") {
    super(message, code);
  }
}

/**
 * Thrown when an HTTP request or attempt times out
 */
export class OracleTimeoutError extends OracleError {
  public readonly timeoutMs: number;
  public readonly operationName?: string;
  public readonly url?: string;
  public readonly attempt: number;
  public readonly isTotalTimeout: boolean;

  constructor(
    message: string,
    options: {
      timeoutMs: number;
      operationName?: string;
      url?: string;
      attempt?: number;
      isTotalTimeout?: boolean;
    }
  ) {
    super(message, "ORACLE_TIMEOUT_ERROR");
    this.timeoutMs = options.timeoutMs;
    this.operationName = options.operationName;
    this.url = options.url;
    this.attempt = options.attempt ?? 1;
    this.isTotalTimeout = options.isTotalTimeout ?? false;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs,
      operationName: this.operationName,
      url: this.url,
      attempt: this.attempt,
      isTotalTimeout: this.isTotalTimeout,
    };
  }
}

/**
 * Thrown when a low-level network or socket failure occurs
 */
export class OracleNetworkError extends OracleError {
  public readonly url?: string;
  public readonly originalError?: unknown;

  constructor(message: string, options: { url?: string; originalError?: unknown } = {}) {
    super(message, "ORACLE_NETWORK_ERROR");
    this.url = options.url;
    this.originalError = options.originalError;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      url: this.url,
      originalError:
        this.originalError instanceof Error
          ? {
              message: this.originalError.message,
              name: this.originalError.name,
              stack: this.originalError.stack,
            }
          : this.originalError,
    };
  }
}

/**
 * Thrown when the Oracle node server responds with a non-2xx HTTP status
 */
export class OracleHttpError<T = unknown> extends OracleError {
  public readonly status: number;
  public readonly statusText: string;
  public readonly headers: Record<string, string>;
  public readonly responseBody?: T;
  public readonly url?: string;

  constructor(
    message: string,
    options: {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      responseBody?: T;
      url?: string;
      code?: string;
    }
  ) {
    super(message, options.code ?? `ORACLE_HTTP_${options.status}`);
    this.status = options.status;
    this.statusText = options.statusText;
    this.headers = options.headers;
    this.responseBody = options.responseBody;
    this.url = options.url;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      responseBody: this.responseBody,
      url: this.url,
    };
  }
}

/**
 * Thrown when HTTP 429 Too Many Requests is received
 */
export class OracleRateLimitError extends OracleHttpError {
  public readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      responseBody?: unknown;
      url?: string;
      retryAfterMs?: number;
    }
  ) {
    super(message, {
      ...options,
      code: "ORACLE_RATE_LIMIT_ERROR",
    });
    this.retryAfterMs = options.retryAfterMs;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfterMs: this.retryAfterMs,
    };
  }
}

/**
 * Thrown when all retry attempts have been exhausted
 */
export class OracleRetryExhaustedError extends OracleError {
  public readonly attempts: number;
  public readonly errors: unknown[];
  public readonly lastError: unknown;
  public readonly totalDurationMs: number;

  constructor(
    message: string,
    options: {
      attempts: number;
      errors: unknown[];
      totalDurationMs: number;
    }
  ) {
    super(message, "ORACLE_RETRY_EXHAUSTED");
    this.attempts = options.attempts;
    this.errors = options.errors;
    this.lastError = options.errors[options.errors.length - 1];
    this.totalDurationMs = options.totalDurationMs;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      attempts: this.attempts,
      totalDurationMs: this.totalDurationMs,
      errorsCount: this.errors.length,
      lastError:
        this.lastError instanceof Error
          ? { message: this.lastError.message, name: this.lastError.name }
          : this.lastError,
    };
  }
}

/**
 * Thrown when an unsafe non-idempotent operation fails and retry is rejected
 */
export class OracleNonIdempotentError extends OracleError {
  public readonly operationName?: string;
  public readonly method?: string;

  constructor(message: string, options: { operationName?: string; method?: string } = {}) {
    super(message, "ORACLE_NON_IDEMPOTENT_ERROR");
    this.operationName = options.operationName;
    this.method = options.method;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      operationName: this.operationName,
      method: this.method,
    };
  }
}

/**
 * Thrown when the circuit breaker is in OPEN state and fast-fails requests
 */
export class OracleCircuitBreakerError extends OracleError {
  public readonly cooldownRemainingMs: number;

  constructor(message: string, cooldownRemainingMs: number) {
    super(message, "ORACLE_CIRCUIT_BREAKER_OPEN");
    this.cooldownRemainingMs = cooldownRemainingMs;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      cooldownRemainingMs: this.cooldownRemainingMs,
    };
  }
}
