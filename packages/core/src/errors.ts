/**
 * Shared serializable API error contract for @chenaikit packages and applications.
 */

export const API_ERROR_CODES = [
  "validation_error",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limit_exceeded",
  "database_error",
  "internal_error",
  "unknown_error",
] as const;

export type KnownApiErrorCode = (typeof API_ERROR_CODES)[number];
export type ApiErrorCode = KnownApiErrorCode | (string & {});

export const DEFAULT_INTERNAL_ERROR_MESSAGE =
  "An unexpected error occurred. Contact support with the request ID below if this persists.";

export interface ApiErrorPayload {
  /** Stable machine-readable error code (e.g. "validation_error", "not_found", "internal_error"). */
  error: ApiErrorCode;
  /** User-safe human-readable message suitable for display or client diagnostics. */
  message: string;
  /** Optional HTTP status code associated with the failure. */
  statusCode?: number;
  /** Optional request correlation ID for support and log lookup. */
  requestId?: string;
  /** Optional safe structured context (such as field-level validation metadata). */
  details?: Record<string, unknown>;
  /** Optional retry delay in seconds for rate-limited or transient failures. */
  retryAfter?: number;
}

const SENSITIVE_DETAIL_KEYS = new Set([
  "stack",
  "stackTrace",
  "cause",
  "sql",
  "raw",
  "password",
  "secret",
  "token",
  "authorization",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strips sensitive internal fields from error details before serialization.
 */
export function sanitizeErrorDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!isPlainRecord(details)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_DETAIL_KEYS.has(key) || value === undefined) {
      continue;
    }
    sanitized[key] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Runtime type guard for narrowing unknown values to a structured `ApiErrorPayload`.
 */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!isPlainRecord(value)) {
    return false;
  }

  if (typeof value.error !== "string" || value.error.trim().length === 0) {
    return false;
  }

  if (typeof value.message !== "string") {
    return false;
  }

  if (
    value.statusCode !== undefined &&
    (typeof value.statusCode !== "number" || !Number.isFinite(value.statusCode))
  ) {
    return false;
  }

  if (value.requestId !== undefined && typeof value.requestId !== "string") {
    return false;
  }

  if (value.details !== undefined && !isPlainRecord(value.details)) {
    return false;
  }

  if (
    value.retryAfter !== undefined &&
    (typeof value.retryAfter !== "number" || !Number.isFinite(value.retryAfter))
  ) {
    return false;
  }

  return true;
}

/**
 * Constructs a clean, JSON-serializable `ApiErrorPayload` with undefined and
 * sensitive detail properties omitted.
 */
export function createApiErrorPayload(input: ApiErrorPayload): ApiErrorPayload {
  const sanitizedDetails = sanitizeErrorDetails(input.details);

  return {
    error: input.error,
    message: input.message,
    ...(typeof input.statusCode === "number" && Number.isFinite(input.statusCode)
      ? { statusCode: input.statusCode }
      : {}),
    ...(typeof input.requestId === "string" && input.requestId.trim().length > 0
      ? { requestId: input.requestId }
      : {}),
    ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
    ...(typeof input.retryAfter === "number" && Number.isFinite(input.retryAfter)
      ? { retryAfter: input.retryAfter }
      : {}),
  };
}

export interface UnknownErrorFallbackOptions {
  requestId?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Converts an arbitrary unknown error into a safe `internal_error` payload
 * without leaking raw error messages, stack traces, or internal details.
 */
export function toUnknownApiErrorPayload(
  _error: unknown,
  options: UnknownErrorFallbackOptions = {},
): ApiErrorPayload {
  return createApiErrorPayload({
    error: "internal_error",
    message: options.message ?? DEFAULT_INTERNAL_ERROR_MESSAGE,
    statusCode: options.statusCode,
    requestId: options.requestId,
  });
}

export interface NormalizeClientErrorOptions {
  /** Whether raw `Error.message` values may be surfaced (e.g. in development). Defaults to false. */
  exposeErrorMessage?: boolean;
  /** Generic fallback message used when an unknown error cannot be safely exposed. */
  fallbackMessage?: string;
}

/**
 * Normalizes a caught client or render error into a structured `ApiErrorPayload`.
 *
 * - If the input (or `error.cause`) is already a valid `ApiErrorPayload`, its
 *   structured fields (`error`, `message`, `requestId`, `details`, `retryAfter`)
 *   are preserved after detail sanitization.
 * - Otherwise, returns an `unknown_error` payload that only surfaces the raw
 *   `Error.message` when `exposeErrorMessage` is explicitly enabled.
 */
export function normalizeClientError(
  error: unknown,
  options: NormalizeClientErrorOptions = {},
): ApiErrorPayload {
  const fallbackMessage = options.fallbackMessage ?? DEFAULT_INTERNAL_ERROR_MESSAGE;

  if (isApiErrorPayload(error)) {
    return createApiErrorPayload(error);
  }

  if (isPlainRecord(error) && isApiErrorPayload(error.cause)) {
    return createApiErrorPayload(error.cause);
  }

  if (error instanceof Error) {
    const record = error as Error & {
      code?: unknown;
      requestId?: unknown;
      statusCode?: unknown;
      retryAfter?: unknown;
      details?: unknown;
    };

    return createApiErrorPayload({
      error:
        typeof record.code === "string" && record.code.trim().length > 0
          ? record.code
          : "unknown_error",
      message: options.exposeErrorMessage ? error.message || fallbackMessage : fallbackMessage,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
      requestId: typeof record.requestId === "string" ? record.requestId : undefined,
      retryAfter: typeof record.retryAfter === "number" ? record.retryAfter : undefined,
      details: isPlainRecord(record.details) ? record.details : undefined,
    });
  }

  return createApiErrorPayload({
    error: "unknown_error",
    message: fallbackMessage,
  });
}
