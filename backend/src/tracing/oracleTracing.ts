/**
 * Oracle Network Tracing Utilities
 *
 * Provides specialized tracing for oracle network operations:
 * - End-to-end inference request tracking
 * - Commit-reveal phase monitoring
 * - Dispute resolution tracing
 * - Node performance metrics
 */

import { context, trace, Span, SpanAttributes, SpanStatusCode } from '@opentelemetry/api';
import { createSpan, endSpan, endSpanWithError } from './tracer';

export interface OracleTraceAttributes {
  requestId: string;
  nodeId?: string;
  modelHash: string;
  phase?: 'commit' | 'reveal' | 'aggregation' | 'dispute';
  contractAddress?: string;
  network?: string;
}

export interface InferenceTraceAttributes extends OracleTraceAttributes {
  inputFeatures?: Record<string, number>;
  outputValue?: number;
  inferenceTimeMs?: number;
  driftDetected?: boolean;
}

export interface DisputeTraceAttributes extends OracleTraceAttributes {
  disputerId?: string;
  reason?: string;
  votesFor?: number;
  votesAgainst?: number;
  resolution?: string;
}

/**
 * Trace an end-to-end inference request through the oracle network
 */
export function traceInferenceRequest(
  attributes: InferenceTraceAttributes,
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.inference_request',
      attributes: {
        'oracle.request_id': attributes.requestId,
        'oracle.model_hash': attributes.modelHash,
        'oracle.node_id': attributes.nodeId || 'unknown',
        'oracle.contract_address': attributes.contractAddress || 'unknown',
        'oracle.network': attributes.network || 'unknown',
        'oracle.input_features': JSON.stringify(attributes.inputFeatures || {}),
        'oracle.drift_detected': attributes.driftDetected || false,
      },
    },
    config
  );

  if (span) {
    span.addEvent('inference_started', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Trace commit phase submission
 */
export function traceCommitSubmission(
  attributes: OracleTraceAttributes,
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.commit_submission',
      attributes: {
        'oracle.request_id': attributes.requestId,
        'oracle.node_id': attributes.nodeId || 'unknown',
        'oracle.model_hash': attributes.modelHash,
        'oracle.phase': 'commit',
        'oracle.contract_address': attributes.contractAddress || 'unknown',
      },
    },
    config
  );

  if (span) {
    span.addEvent('commit_submitted', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Trace reveal phase submission
 */
export function traceRevealSubmission(
  attributes: OracleTraceAttributes & { value: number },
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.reveal_submission',
      attributes: {
        'oracle.request_id': attributes.requestId,
        'oracle.node_id': attributes.nodeId || 'unknown',
        'oracle.model_hash': attributes.modelHash,
        'oracle.phase': 'reveal',
        'oracle.value': attributes.value,
        'oracle.contract_address': attributes.contractAddress || 'unknown',
      },
    },
    config
  );

  if (span) {
    span.addEvent('reveal_submitted', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Trace aggregation phase
 */
export function traceAggregation(
  attributes: OracleTraceAttributes & {
    numSubmissions: number;
    aggregatedValue: number;
    variance: number;
  },
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.aggregation',
      attributes: {
        'oracle.request_id': attributes.requestId,
        'oracle.model_hash': attributes.modelHash,
        'oracle.phase': 'aggregation',
        'oracle.num_submissions': attributes.numSubmissions,
        'oracle.aggregated_value': attributes.aggregatedValue,
        'oracle.variance': attributes.variance,
        'oracle.contract_address': attributes.contractAddress || 'unknown',
      },
    },
    config
  );

  if (span) {
    span.addEvent('aggregation_completed', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Trace dispute filing and resolution
 */
export function traceDispute(
  attributes: DisputeTraceAttributes,
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.dispute',
      attributes: {
        'oracle.request_id': attributes.requestId,
        'oracle.disputer_id': attributes.disputerId || 'unknown',
        'oracle.reason': attributes.reason || 'unknown',
        'oracle.phase': 'dispute',
        'oracle.votes_for': attributes.votesFor || 0,
        'oracle.votes_against': attributes.votesAgainst || 0,
        'oracle.resolution': attributes.resolution || 'pending',
        'oracle.contract_address': attributes.contractAddress || 'unknown',
      },
    },
    config
  );

  if (span) {
    span.addEvent('dispute_filed', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Trace node performance metrics
 */
export function traceNodePerformance(
  attributes: {
    nodeId: string;
    uptime: number;
    totalRequests: number;
    successfulSubmissions: number;
    failedSubmissions: number;
    averageResponseTime: number;
    reputation: number;
  },
  config: any
): Span | null {
  const span = createSpan(
    {
      name: 'oracle.node_performance',
      attributes: {
        'oracle.node_id': attributes.nodeId,
        'oracle.uptime': attributes.uptime,
        'oracle.total_requests': attributes.totalRequests,
        'oracle.successful_submissions': attributes.successfulSubmissions,
        'oracle.failed_submissions': attributes.failedSubmissions,
        'oracle.average_response_time': attributes.averageResponseTime,
        'oracle.reputation': attributes.reputation,
        'oracle.success_rate': attributes.totalRequests > 0
          ? attributes.successfulSubmissions / attributes.totalRequests
          : 0,
      },
    },
    config
  );

  if (span) {
    span.addEvent('performance_recorded', {
      'oracle.timestamp': Date.now(),
    });
  }

  return span;
}

/**
 * Create a trace context for correlation across services
 */
export function createOracleTraceContext(requestId: string, nodeId: string): string {
  return `oracle-${requestId}-${nodeId}`;
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(headers: Record<string, string>): string | null {
  const traceParent = headers['traceparent'] || headers['x-trace-id'];
  return traceParent || null;
}

/**
 * Inject trace context into request headers
 */
export function injectTraceContext(
  headers: Record<string, string>,
  traceContext: string
): Record<string, string> {
  return {
    ...headers,
    'traceparent': traceContext,
    'x-trace-id': traceContext,
  };
}

/**
 * Trace end-to-end inference flow with child spans
 */
export class OracleInferenceTracer {
  private config: any;
  private mainSpan: Span | null = null;
  private childSpans: Map<string, Span> = new Map();

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Start tracing an inference request
   */
  startInference(attributes: InferenceTraceAttributes): void {
    this.mainSpan = traceInferenceRequest(attributes, this.config);
  }

  /**
   * Add a child span for commit submission
   */
  addCommitSpan(attributes: OracleTraceAttributes): void {
    if (!this.mainSpan) return;
    
    const span = traceCommitSubmission(attributes, this.config);
    if (span) {
      this.childSpans.set('commit', span);
    }
  }

  /**
   * Add a child span for reveal submission
   */
  addRevealSpan(attributes: OracleTraceAttributes & { value: number }): void {
    if (!this.mainSpan) return;
    
    const span = traceRevealSubmission(attributes, this.config);
    if (span) {
      this.childSpans.set('reveal', span);
    }
  }

  /**
   * Add a child span for aggregation
   */
  addAggregationSpan(
    attributes: OracleTraceAttributes & {
      numSubmissions: number;
      aggregatedValue: number;
      variance: number;
    }
  ): void {
    if (!this.mainSpan) return;
    
    const span = traceAggregation(attributes, this.config);
    if (span) {
      this.childSpans.set('aggregation', span);
    }
  }

  /**
   * Add a child span for dispute
   */
  addDisputeSpan(attributes: DisputeTraceAttributes): void {
    if (!this.mainSpan) return;
    
    const span = traceDispute(attributes, this.config);
    if (span) {
      this.childSpans.set('dispute', span);
    }
  }

  /**
   * End all child spans
   */
  endChildSpans(attributes?: SpanAttributes): void {
    this.childSpans.forEach((span) => {
      endSpan(span, attributes);
    });
    this.childSpans.clear();
  }

  /**
   * End the main span with success
   */
  endSuccess(attributes?: SpanAttributes): void {
    this.endChildSpans(attributes);
    endSpan(this.mainSpan, attributes);
    this.mainSpan = null;
  }

  /**
   * End the main span with error
   */
  endError(error: Error, attributes?: SpanAttributes): void {
    this.endChildSpans(attributes);
    endSpanWithError(this.mainSpan, error, attributes);
    this.mainSpan = null;
  }

  /**
   * Check if tracing is active
   */
  isActive(): boolean {
    return this.mainSpan !== null;
  }
}

/**
 * Middleware for automatic oracle request tracing
 */
export function oracleTracingMiddleware(config: any) {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || req.body?.requestId || 'unknown';
    const nodeId = req.headers['x-node-id'] || 'unknown';
    
    // Create trace context
    const traceContext = createOracleTraceContext(requestId, nodeId);
    
    // Inject trace context into request
    req.oracleTraceContext = traceContext;
    req.oracleTracer = new OracleInferenceTracer(config);
    
    // Start tracing
    if (req.body?.requestId) {
      req.oracleTracer.startInference({
        requestId: req.body.requestId,
        modelHash: req.body.modelHash || 'unknown',
        nodeId: nodeId,
      });
    }
    
    // Add trace context to response headers
    res.setHeader('x-trace-id', traceContext);
    
    // End tracing on response finish
    res.on('finish', () => {
      if (req.oracleTracer?.isActive()) {
        if (res.statusCode >= 400) {
          req.oracleTracer.endError(new Error(`HTTP ${res.statusCode}`), {
            'http.status_code': res.statusCode,
          });
        } else {
          req.oracleTracer.endSuccess({
            'http.status_code': res.statusCode,
          });
        }
      }
    });
    
    next();
  };
}
