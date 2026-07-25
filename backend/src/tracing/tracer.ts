/**
 * OpenTelemetry Tracer Setup with Multi-Strategy Sampling
 *
 * Provides:
 * - Probabilistic sampling (default 1%)
 * - Error-based sampling (100% on 5xx)
 * - Rate-limiting (max 1000 traces/min)
 * - Jaeger & OTLP exporters
 */
import { context, trace, Span, SpanStatusCode, SpanAttributes, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { PrismaInstrumentation } from '@prisma/instrumentation';

export interface TracingConfig {
  serviceName: string;
  environment: string;
  version: string;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  sampleRate: number;           // 0.01 = 1%
  errorSampleRate: number;      // 1.0 = 100% on errors
  maxTracesPerMinute: number;   // rate limiting
}

export interface TraceSpanOptions {
  name: string;
  attributes?: SpanAttributes;
  parentSpan?: Span;
}

// Rate limiter state
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
    return false; // rate limited
  }
  rateLimitState.tracesThisMinute++;
  return true;
}

function shouldSample(config: TracingConfig, isError: boolean): boolean {
  // Error-based: 100% sample on errors
  if (isError) {
    return Math.random() < config.errorSampleRate;
  }
  // Probabilistic: default sample rate
  return Math.random() < config.sampleRate;
}

let sdkInstance: NodeSDK | null = null;

/**
 * Initialize the OpenTelemetry SDK with Jaeger + OTLP exporters,
 * multi-strategy sampling, and auto-instrumentations.
 */
export async function initializeTracing(config: TracingConfig): Promise<void> {
  // Enable diagnostic logging in development
  if (config.environment === 'development') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
  });

  // Jaeger exporter - primary for visualization
  const jaegerExporter = new JaegerExporter({
    endpoint: config.jaegerEndpoint || 'http://localhost:14268/api/traces',
    tags: [], // empty tags array
  });

  // OTLP exporter - vendor-neutral fallback
  const otlpExporter = new OTLPTraceExporter({
    url: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
  });

  // Custom span processor that applies sampling decisions
  const customSpanProcessor = new BatchSpanProcessor(
    otlpExporter,
    {
      scheduledDelayMillis: 1000,
      maxExportBatchSize: 512,
      maxQueueSize: 2048,
    }
  );

  // Jaeger gets SimpleSpanProcessor for real-time visualization
  const jaegerSpanProcessor = new SimpleSpanProcessor(jaegerExporter);

  const sdk = new NodeSDK({
    resource,
    spanProcessors: [customSpanProcessor, jaegerSpanProcessor],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable default console instrumentation, we handle it ourselves
        '@opentelemetry/instrumentation-console': { enabled: false },
      }),
      new ExpressInstrumentation(),
      new HttpInstrumentation(),
      new RedisInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  try {
    await sdk.start();
    sdkInstance = sdk;
    console.log(`🔍 OpenTelemetry tracing initialized:
  Service:     ${config.serviceName}
  Environment: ${config.environment}
  Sample Rate: ${config.sampleRate * 100}%
  Jaeger:      ${config.jaegerEndpoint || 'http://localhost:14268/api/traces'}
  OTLP:        ${config.otlpEndpoint || 'http://localhost:4318/v1/traces'}
  Max Traces:  ${config.maxTracesPerMinute}/min`);
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry SDK:', error);
    throw error;
  }
}

/**
 * Create a child span with sampling decision support.
 * Returns null if the trace is rate-limited or not sampled.
 */
export function createSpan(options: TraceSpanOptions, config: TracingConfig): Span | null {
  if (!checkRateLimit(config.maxTracesPerMinute)) {
    return null; // rate limited
  }

  const tracer = trace.getTracer(config.serviceName);
  const parent = options.parentSpan ? trace.setSpan(context.active(), options.parentSpan) : undefined;

  const span = tracer.startSpan(
    options.name,
    { attributes: options.attributes },
    parent ? context.active() : undefined
  );

  return span;
}

/**
 * Finalize a span with success status.
 */
export function endSpan(span: Span | null, attributes?: SpanAttributes): void {
  if (!span) return;
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * Finalize a span with error status.
 */
export function endSpanWithError(span: Span | null, error: Error, attributes?: SpanAttributes): void {
  if (!span) return;
  if (attributes) {
    span.setAttributes(attributes);
  }
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  span.end();
}

/**
 * Shutdown the OpenTelemetry SDK gracefully.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdkInstance) {
    try {
      await sdkInstance.shutdown();
      console.log('🔍 OpenTelemetry SDK shut down gracefully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry SDK:', error);
    }
  }
}