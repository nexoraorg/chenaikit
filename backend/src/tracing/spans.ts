/**
 * Custom Span Decorators for Application-Specific Tracing
 *
 * Wrapper functions for:
 * - Credit scoring (duration, model version, feature weights)
 * - Fraud detection (risk score calculation time)
 * - External API calls (Stellar Horizon, OpenAI, email service)
 */
import { trace, Span, SpanStatusCode, SpanAttributes, context, propagation } from '@opentelemetry/api';
import { TracingConfig, createSpan, endSpan, endSpanWithError } from './tracer';

// ---------------------------------------------------------------------------
// Credit Scoring Spans
// ---------------------------------------------------------------------------

export interface CreditScoreTraceInput {
  userId: string;
  modelVersion: string;
  featureWeights: Record<string, number>;
  inputFeatures: Record<string, number>;
  tenantId?: string;
}

export interface CreditScoreTraceOutput {
  score: number;
  confidence: number;
  durationMs: number;
}

/**
 * Trace a credit scoring operation.
 * Records model version, feature weights, input features, and compute duration.
 */
export async function traceCreditScore(
  config: TracingConfig,
  input: CreditScoreTraceInput,
  scoringFn: () => Promise<CreditScoreTraceOutput>
): Promise<CreditScoreTraceOutput> {
  const span = createSpan(
    {
      name: 'credit_score.calculate',
      attributes: {
        'credit_score.user_id': input.userId,
        'credit_score.model_version': input.modelVersion,
        'credit_score.tenant_id': input.tenantId || 'default',
        'credit_score.feature_count': Object.keys(input.featureWeights).length,
        'credit_score.input_feature_count': Object.keys(input.inputFeatures).length,
      },
    },
    config
  );

  // Record feature weights as span attributes (limit to top 10 to avoid large payloads)
  if (span) {
    const topFeatures = Object.entries(input.featureWeights)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 10);

    topFeatures.forEach(([key, value], index) => {
      span.setAttribute(`credit_score.feature_weight_${key}`, value);
    });
  }

  const startTime = Date.now();

  try {
    const result = await scoringFn();
    const duration = Date.now() - startTime;

    if (span) {
      span.setAttributes({
        'credit_score.result': result.score,
        'credit_score.confidence': result.confidence,
        'credit_score.duration_ms': duration,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    return { ...result, durationMs: duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    endSpanWithError(span as Span | null, error as Error, {
      'credit_score.duration_ms': duration,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Fraud Detection Spans
// ---------------------------------------------------------------------------

export interface FraudDetectionTraceInput {
  transactionId: string;
  userId: string;
  amount: number;
  riskFactors: string[];
  tenantId?: string;
}

export interface FraudDetectionTraceOutput {
  riskScore: number;
  isFraudulent: boolean;
  calculationTimeMs: number;
  contributingFactors: string[];
}

/**
 * Trace a fraud detection operation.
 * Records risk score, calculation time, and contributing factors.
 */
export async function traceFraudDetection(
  config: TracingConfig,
  input: FraudDetectionTraceInput,
  detectionFn: () => Promise<FraudDetectionTraceOutput>
): Promise<FraudDetectionTraceOutput> {
  const span = createSpan(
    {
      name: 'fraud_detection.analyze',
      attributes: {
        'fraud_detection.transaction_id': input.transactionId,
        'fraud_detection.user_id': input.userId,
        'fraud_detection.amount': input.amount,
        'fraud_detection.risk_factor_count': input.riskFactors.length,
        'fraud_detection.tenant_id': input.tenantId || 'default',
      },
    },
    config
  );

  const startTime = Date.now();

  try {
    const result = await detectionFn();
    const duration = Date.now() - startTime;

    if (span) {
      span.setAttributes({
        'fraud_detection.risk_score': result.riskScore,
        'fraud_detection.is_fraudulent': result.isFraudulent,
        'fraud_detection.calculation_time_ms': duration,
        'fraud_detection.contributing_factors': result.contributingFactors.join(', '),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    return { ...result, calculationTimeMs: duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    endSpanWithError(span as Span | null, error as Error, {
      'fraud_detection.calculation_time_ms': duration,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// External API Call Spans
// ---------------------------------------------------------------------------

export type ExternalApiType = 'stellar_horizon' | 'openai' | 'email_service' | 'other';

export interface ExternalAPITraceInput {
  apiType: ExternalApiType;
  endpoint: string;
  method: string;
  requestBody?: string;
  tenantId?: string;
}

export interface ExternalAPITraceOutput {
  statusCode: number;
  responseSizeBytes?: number;
  durationMs: number;
  cached?: boolean;
}

/**
 * Trace an external API call.
 * Supports Stellar Horizon, OpenAI, and email service with specific attributes.
 */
export async function traceExternalAPI<T extends ExternalAPITraceOutput>(
  config: TracingConfig,
  input: ExternalAPITraceInput,
  apiCall: () => Promise<T>
): Promise<T> {
  const spanName = `external_api.${input.apiType}`;
  const span = createSpan(
    {
      name: spanName,
      attributes: {
        'external_api.type': input.apiType,
        'external_api.endpoint': input.endpoint,
        'external_api.method': input.method,
        'external_api.tenant_id': input.tenantId || 'default',
      },
    },
    config
  );

  const startTime = Date.now();

  try {
    const result = await apiCall();
    const duration = Date.now() - startTime;

    if (span) {
      span.setAttributes({
        'external_api.status_code': result.statusCode,
        'external_api.duration_ms': duration,
        'external_api.response_size_bytes': result.responseSizeBytes || 0,
        'external_api.cached': result.cached || false,
      });

      // API-specific attributes
      switch (input.apiType) {
        case 'stellar_horizon':
          span.setAttribute('external_api.stellar_horizon_version', 'v3');
          break;
        case 'openai':
          span.setAttribute('external_api.openai_model', 'gpt-4');
          break;
        case 'email_service':
          span.setAttribute('external_api.email_provider', 'nodemailer');
          break;
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    }

    return { ...result, durationMs: duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    endSpanWithError(span as Span | null, error as Error, {
      'external_api.duration_ms': duration,
    });
    throw error;
  }
}