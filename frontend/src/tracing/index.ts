/**
 * Frontend Tracing Module
 *
 * Central export for all distributed tracing utilities on the frontend.
 *
 * Usage:
 *   import { initializeWebTracing, TracedComponent, withTracing, useTracedCallback } from '../tracing';
 */
export { initializeWebTracing, startUserActionSpan, endUserActionSpan, endUserActionSpanWithError, getWebTraceId, getWebTraceparent, shutdownWebTracing } from './webTracer';
export type { WebTracingConfig } from './webTracer';
export { TracedComponent, withTracing, useTracedCallback } from './TracedComponent';
export type { TracedComponentProps } from './TracedComponent';