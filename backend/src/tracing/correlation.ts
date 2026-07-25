/**
 * Trace-Log Correlation and Trace-Metrics Exemplars
 *
 * Injects trace IDs into:
 * - Structured log metadata (Winston logger integration)
 * - Response headers (x-trace-id, traceparent)
 * - Prometheus metrics as exemplars
 */
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Trace ID extraction helpers
// ---------------------------------------------------------------------------

/**
 * Get the current trace ID from the active span context.
 */
export function getCurrentTraceId(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;
  return currentSpan.spanContext().traceId;
}

/**
 * Get the current span ID from the active span context.
 */
export function getCurrentSpanId(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;
  return currentSpan.spanContext().spanId;
}

/**
 * Get the current trace flags from the active span context.
 */
export function getCurrentTraceFlags(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;
  return currentSpan.spanContext().traceFlags.toString(16).padStart(2, '0');
}

/**
 * Get the full traceparent header value for the current span.
 */
export function getCurrentTraceparent(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;
  const ctx = currentSpan.spanContext();
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Trace-Log Correlation
// ---------------------------------------------------------------------------

/**
 * Build log metadata enriched with tracing context.
 * This can be spread into any structured log entry.
 *
 * Usage:
 *   logger.info('Credit score calculated', { ...traceLogMetadata(), score: 750 });
 */
export function traceLogMetadata(): Record<string, string | undefined> {
  const traceId = getCurrentTraceId();
  const spanId = getCurrentSpanId();
  return {
    trace_id: traceId || undefined,
    span_id: spanId || undefined,
    traceparent: traceId && spanId ? `00-${traceId}-${spanId}-01` : undefined,
  };
}

/**
 * Express middleware that enriches the request object with trace context
 * and injects trace ID into response headers for frontend correlation.
 */
export function tracingCorrelationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = getCurrentTraceId();
  const spanId = getCurrentSpanId();

  if (traceId) {
    // Attach trace context to request for downstream use
    (req as any).traceContext = {
      traceId,
      spanId,
      traceparent: getCurrentTraceparent(),
    };

    // Inject into response headers for frontend/backend correlation
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-span-id', spanId);
    res.setHeader('traceparent', getCurrentTraceparent() || '');

    // Also add as log-friendly header
    const requestId = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : (req.headers['x-request-id'] as string | undefined);
    res.setHeader('x-request-id', requestId || traceId);
  }

  next();
}

// ---------------------------------------------------------------------------
// Trace Exemplars for Metrics
// ---------------------------------------------------------------------------

/**
 * Format trace exemplar data for Prometheus metrics.
 * Exemplars allow metrics to be correlated with traces.
 *
 * Usage:
 *   histogram.observe(value, { trace_exemplar: formatExemplar() });
 */
export function formatExemplar(): string | undefined {
  const traceId = getCurrentTraceId();
  const spanId = getCurrentSpanId();
  if (!traceId || !spanId) return undefined;
  return JSON.stringify({
    traceId,
    spanId,
    timestamp: Date.now() / 1000,
  });
}

// ---------------------------------------------------------------------------
// Trace-Enriched Logger Wrapper
// ---------------------------------------------------------------------------

export interface TracedLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Create a logger wrapper that automatically injects trace context
 * into every log entry.
 */
export function createTracedLogger(logger: TracedLogger): TracedLogger {
  const withTrace = (meta?: Record<string, unknown>): Record<string, unknown> => {
    return {
      ...meta,
      ...traceLogMetadata(),
    };
  };

  return {
    info: (message, meta) => logger.info(message, withTrace(meta)),
    warn: (message, meta) => logger.warn(message, withTrace(meta)),
    error: (message, meta) => logger.error(message, withTrace(meta)),
    debug: (message, meta) => logger.debug(message, withTrace(meta)),
  };
}