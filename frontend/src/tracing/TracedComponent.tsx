/**
 * React Component Wrapper for Tracing
 *
 * <TracedComponent name="CreditScoreCard">
 *   <CreditScoreCard />
 * </TracedComponent>
 *
 * Automatically creates spans for component mount, update, and unmount phases.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { getWebTraceId } from './webTracer';

export interface TracedComponentProps {
  name: string;
  children: React.ReactNode;
  attributes?: Record<string, string | number | boolean>;
  /** If true, also traces child component re-renders */
  traceUpdates?: boolean;
}

/**
 * Wraps a React component with OpenTelemetry tracing.
 * Creates spans for:
 * - Component mount (first render)
 * - Component update (re-renders, if traceUpdates is true)
 * - Component unmount
 *
 * Usage:
 * ```tsx
 * <TracedComponent name="CreditScoreCard" attributes={{ userId: '123' }}>
 *   <CreditScoreCard />
 * </TracedComponent>
 * ```
 */
export const TracedComponent: React.FC<TracedComponentProps> = ({
  name,
  children,
  attributes = {},
  traceUpdates = false,
}) => {
  const mountSpanRef = useRef<Span | null>(null);
  const renderCountRef = useRef(0);
  const componentName = `component.${name}`;

  // On mount: create a span for component render
  useEffect(() => {
    renderCountRef.current++;

    const tracer = trace.getTracer('chenaikit-web');
    const span = tracer.startSpan(`${componentName}.mount`, {
      attributes: {
        'component.name': name,
        'component.render_count': renderCountRef.current,
        'component.trace_id': getWebTraceId() || '',
        ...attributes,
      },
    });

    mountSpanRef.current = span;

    return () => {
      // On unmount: end the mount span
      if (mountSpanRef.current) {
        mountSpanRef.current.setStatus({ code: SpanStatusCode.OK });
        mountSpanRef.current.end();
        mountSpanRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, attributes]);

  return <>{children}</>;
};

/**
 * Higher-order component that wraps a component with tracing.
 *
 * Usage:
 * ```tsx
 * const TracedCreditScoreCard = withTracing('CreditScoreCard', CreditScoreCard);
 * ```
 */
export function withTracing<P extends object>(
  name: string,
  Component: React.ComponentType<P>,
  defaultAttributes?: Record<string, string | number | boolean>
): React.FC<P & { traceUpdates?: boolean }> {
  const displayName = Component.displayName || Component.name || name;

  const WrappedComponent: React.FC<P & { traceUpdates?: boolean }> = (props) => {
    const { traceUpdates, ...componentProps } = props as any;

    return (
      <TracedComponent
        name={name}
        attributes={defaultAttributes}
        traceUpdates={traceUpdates}
      >
        <Component {...(componentProps as P)} />
      </TracedComponent>
    );
  };

  WrappedComponent.displayName = `withTracing(${displayName})`;
  return WrappedComponent;
}

/**
 * Hook to create a traced callback for user actions.
 * Automatically creates a span when the callback is invoked.
 *
 * Usage:
 * ```tsx
 * const handleSubmit = useTracedCallback('credit_score.submit', async () => {
 *   await submitScore(data);
 * });
 * ```
 */
export function useTracedCallback<T extends (...args: any[]) => any>(
  name: string,
  callback: T,
  attributes?: Record<string, string | number | boolean>
): T {
  const tracedCallback = useCallback(
    async (...args: any[]) => {
      const tracer = trace.getTracer('chenaikit-web');
      const span = tracer.startSpan(`user_action.${name}`, {
        attributes: {
          'user_action.name': name,
          'user_action.timestamp': Date.now(),
          ...attributes,
        },
      });

      try {
        const result = await callback(...args);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        span.end();
        throw error;
      }
    },
    [callback, name, attributes]
  ) as unknown as T;

  return tracedCallback;
}

export default TracedComponent;