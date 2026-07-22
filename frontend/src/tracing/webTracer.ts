/**
 * Frontend OpenTelemetry Web Tracer
 *
 * Integrates @opentelemetry/sdk-trace-web with:
 * - BrowserTracerProvider
 * - User action tracing (clicks, navigation, form submissions)
 * - Network request tracing (fetch/XHR)
 * - Performance marks (first paint, first contentful paint)
 * - Backend correlation via traceparent header
 */
import { trace, context, Span, SpanStatusCode, SpanAttributes, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

export interface WebTracingConfig {
  serviceName: string;
  environment: string;
  version: string;
  otlpEndpoint?: string;
  sampleRate: number;
  maxTracesPerMinute: number;
  ignoredUrls?: RegExp[];
  propagateTraceHeaderCorsUrls?: RegExp[];
}

// Rate limiter for frontend
const rateLimitState = {
  tracesThisMinute: 0,
  currentMinute: Math.floor(Date.now() / 60000),
};

function checkRateLimit(maxTracesPerMinute: number): boolean {
  const now = Math.floor(Date.now() / 60000);
  if (now !== rateLimitState.currentMinute) {
    rateLimitState.currentMinute = now;
    rateLimitState.tracesThisMinute = 0;
  }
  if (rateLimitState.tracesThisMinute >= maxTracesPerMinute) {
    return false;
  }
  rateLimitState.tracesThisMinute++;
  return true;
}

let webTracerProvider: WebTracerProvider | null = null;

/**
 * Initialize the OpenTelemetry Web Tracer Provider.
 * Must be called once at application startup (index.tsx).
 */
export function initializeWebTracing(config: WebTracingConfig): WebTracerProvider {
  if (webTracerProvider) {
    // eslint-disable-next-line no-console
    console.warn('WebTracerProvider already initialized');
    return webTracerProvider;
  }

  // Enable diagnostic logging in development
  if (config.environment === 'development') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
  });

  // OTLP exporter for traces
  const otlpExporter = new OTLPTraceExporter({
    url: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
  });

  // Create WebTracerProvider with ZoneContextManager for async context propagation
  webTracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(otlpExporter, {
        scheduledDelayMillis: 1000,
        maxExportBatchSize: 512,
        maxQueueSize: 2048,
      }),
    ],
  });

  // Register context manager for async operations
  webTracerProvider.register({
    contextManager: new ZoneContextManager(),
  });

  // Register instrumentations
  registerInstrumentations({
    tracerProvider: webTracerProvider,
    instrumentations: [
      // XMLHttpRequest instrumentation
      new XMLHttpRequestInstrumentation({
        ignoreUrls: config.ignoredUrls || [/healthz/, /liveness/, /readiness/],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls || [
          /http:\/\/localhost:5000/,
          /http:\/\/localhost:3000/,
          /https:\/\/api\.chenaikit\.com/,
        ],
      }),
      // Fetch API instrumentation
      new FetchInstrumentation({
        ignoreUrls: config.ignoredUrls || [/healthz/, /liveness/, /readiness/],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls || [
          /http:\/\/localhost:5000/,
          /http:\/\/localhost:3000/,
          /https:\/\/api\.chenaikit\.com/,
        ],
      }),
      // User interaction instrumentation (clicks, form submissions)
      new UserInteractionInstrumentation(),
      // Document load instrumentation (first paint, first contentful paint)
      new DocumentLoadInstrumentation(),
    ],
  });

  // Record performance marks for rendering phases
  recordPerformanceMarks();

  // eslint-disable-next-line no-console
  console.log(
    `🔍 Web Tracing initialized:\n` +
      `  Service:     ${config.serviceName}\n` +
      `  Environment: ${config.environment}\n` +
      `  Sample Rate: ${config.sampleRate * 100}%\n` +
      `  OTLP:        ${config.otlpEndpoint || 'http://localhost:4318/v1/traces'}\n` +
      `  Max Traces:  ${config.maxTracesPerMinute}/min`
  );

  return webTracerProvider;
}

/**
 * Record performance marks for key rendering phases.
 * Uses PerformanceObserver to capture:
 * - First Paint (FP)
 * - First Contentful Paint (FCP)
 * - Largest Contentful Paint (LCP)
 * - First Input Delay (FID)
 */
function recordPerformanceMarks(): void {
  if (typeof window === 'undefined' || !window.performance) return;

  const tracer = trace.getTracer('chenaikit-web');

  // First Paint / First Contentful Paint
  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const span = tracer.startSpan(`performance.${entry.name}`, {
          attributes: {
            'performance.entry_type': entry.entryType,
            'performance.name': entry.name,
            'performance.start_time': entry.startTime,
            'performance.duration': entry.duration,
          },
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch (e) {
    // PerformanceObserver may not be available
  }

  // Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        const span = tracer.startSpan('performance.largest_contentful_paint', {
          attributes: {
            'performance.entry_type': lastEntry.entryType,
            'performance.start_time': lastEntry.startTime,
            'performance.duration': lastEntry.duration,
            'performance.size': (lastEntry as any).size || 0,
            'performance.element': (lastEntry as any).element?.tagName || 'unknown',
          },
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // LCP not supported
  }

  // First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const span = tracer.startSpan('performance.first_input_delay', {
          attributes: {
            'performance.entry_type': entry.entryType,
            'performance.start_time': entry.startTime,
            'performance.duration': entry.duration,
            'performance.input_delay': entry.duration,
            'performance.processing_start': (entry as any).processingStart || 0,
          },
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // FID not supported
  }
}

/**
 * Create a custom user action span.
 */
export function startUserActionSpan(
  name: string,
  attributes?: SpanAttributes
): Span | undefined {
  if (!checkRateLimit(1000)) return undefined;

  const tracer = trace.getTracer('chenaikit-web');
  const span = tracer.startSpan(`user_action.${name}`, {
    attributes: {
      'user_action.name': name,
      'user_action.timestamp': Date.now(),
      ...attributes,
    },
  });
  return span;
}

/**
 * End a user action span with success.
 */
export function endUserActionSpan(span: Span | undefined, attributes?: SpanAttributes): void {
  if (!span) return;
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * End a user action span with error.
 */
export function endUserActionSpanWithError(
  span: Span | undefined,
  error: Error,
  attributes?: SpanAttributes
): void {
  if (!span) return;
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  span.end();
}

/**
 * Get the current trace ID from the web tracer.
 */
export function getWebTraceId(): string | undefined {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return undefined;
  return currentSpan.spanContext().traceId;
}

/**
 * Get the current traceparent header value for backend correlation.
 */
export function getWebTraceparent(): string | undefined {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return undefined;
  const ctx = currentSpan.spanContext();
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
}

/**
 * Shutdown the web tracer provider.
 */
export function shutdownWebTracing(): void {
  if (webTracerProvider) {
    webTracerProvider.shutdown().catch(() => {});
    webTracerProvider = null;
  }
}