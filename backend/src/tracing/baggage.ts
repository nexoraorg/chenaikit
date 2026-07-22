/**
 * Baggage Propagation Middleware
 *
 * Extracts and propagates request context (tenant ID, feature flags, user tier)
 * across service boundaries using W3C Baggage format.
 */
import { Request, Response, NextFunction } from 'express';
import { propagation, context, Span, trace, ROOT_CONTEXT } from '@opentelemetry/api';
import { W3CBaggagePropagator } from '@opentelemetry/propagator-b3';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';

// Register B3 propagator alongside W3C tracecontext
const b3Propagator = new B3Propagator();
const baggagePropagator = new W3CBaggagePropagator();

export interface BaggageContext {
  tenantId?: string;
  userId?: string;
  userTier?: string;
  featureFlags?: string;  // comma-separated
  requestId?: string;
  sessionId?: string;
}

// Default baggage context key constants
export const BAGGAGE_KEYS = {
  TENANT_ID: 'tenant_id',
  USER_ID: 'user_id',
  USER_TIER: 'user_tier',
  FEATURE_FLAGS: 'feature_flags',
  REQUEST_ID: 'request_id',
  SESSION_ID: 'session_id',
} as const;

/**
 * Extract baggage context from incoming request headers.
 * Supports W3C Baggage format: `key1=value1,key2=value2`
 */
export function extractBaggageFromRequest(req: Request): BaggageContext {
  const baggageHeader = req.headers['baggage'] as string || req.headers['x-baggage'] as string;
  const context: BaggageContext = {};

  if (!baggageHeader) return context;

  const entries = baggageHeader.split(',').map(e => e.trim());

  for (const entry of entries) {
    const [key, value] = entry.split('=').map(s => s.trim());
    if (!key || !value) continue;

    switch (key) {
      case BAGGAGE_KEYS.TENANT_ID:
        context.tenantId = decodeURIComponent(value);
        break;
      case BAGGAGE_KEYS.USER_ID:
        context.userId = decodeURIComponent(value);
        break;
      case BAGGAGE_KEYS.USER_TIER:
        context.userTier = decodeURIComponent(value);
        break;
      case BAGGAGE_KEYS.FEATURE_FLAGS:
        context.featureFlags = decodeURIComponent(value);
        break;
      case BAGGAGE_KEYS.REQUEST_ID:
        context.requestId = decodeURIComponent(value);
        break;
      case BAGGAGE_KEYS.SESSION_ID:
        context.sessionId = decodeURIComponent(value);
        break;
    }
  }

  return context;
}

/**
 * Inject baggage context into outgoing request headers.
 * Creates W3C Baggage format: `key1=value1,key2=value2`
 */
export function injectBaggageIntoHeaders(
  headers: Record<string, string>,
  baggage: BaggageContext
): Record<string, string> {
  const baggageParts: string[] = [];

  if (baggage.tenantId) {
    baggageParts.push(`${BAGGAGE_KEYS.TENANT_ID}=${encodeURIComponent(baggage.tenantId)}`);
  }
  if (baggage.userId) {
    baggageParts.push(`${BAGGAGE_KEYS.USER_ID}=${encodeURIComponent(baggage.userId)}`);
  }
  if (baggage.userTier) {
    baggageParts.push(`${BAGGAGE_KEYS.USER_TIER}=${encodeURIComponent(baggage.userTier)}`);
  }
  if (baggage.featureFlags) {
    baggageParts.push(`${BAGGAGE_KEYS.FEATURE_FLAGS}=${encodeURIComponent(baggage.featureFlags)}`);
  }
  if (baggage.requestId) {
    baggageParts.push(`${BAGGAGE_KEYS.REQUEST_ID}=${encodeURIComponent(baggage.requestId)}`);
  }
  if (baggage.sessionId) {
    baggageParts.push(`${BAGGAGE_KEYS.SESSION_ID}=${encodeURIComponent(baggage.sessionId)}`);
  }

  if (baggageParts.length > 0) {
    headers['baggage'] = baggageParts.join(',');
  }

  return headers;
}

/**
 * Express middleware that extracts baggage from incoming requests
 * and enriches the active span with baggage context.
 */
export function baggagePropagationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract baggage from request
  const baggageContext = extractBaggageFromRequest(req);

  if (Object.keys(baggageContext).length > 0) {
    // Attach baggage to active span
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
      // Enrich span with baggage attributes for correlation
      if (baggageContext.tenantId) {
        currentSpan.setAttribute('baggage.tenant_id', baggageContext.tenantId);
      }
      if (baggageContext.userId) {
        currentSpan.setAttribute('baggage.user_id', baggageContext.userId);
      }
      if (baggageContext.userTier) {
        currentSpan.setAttribute('baggage.user_tier', baggageContext.userTier);
      }
      if (baggageContext.featureFlags) {
        currentSpan.setAttribute('baggage.feature_flags', baggageContext.featureFlags);
      }
      if (baggageContext.requestId) {
        currentSpan.setAttribute('baggage.request_id', baggageContext.requestId);
      }
    }

    // Inject baggage into response headers for downstream clients
    injectBaggageIntoHeaders(res.getHeaders() as Record<string, string>, baggageContext);
  }

  // Also add traceparent to response for frontend correlation
  const currentSpan = trace.getSpan(context.active());
  if (currentSpan) {
    const spanContext = currentSpan.spanContext();
    const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`;
    res.setHeader('traceparent', traceparent);
    res.setHeader('x-trace-id', spanContext.traceId);
  }

  next();
}

/**
 * Create a BaggageContext from authenticated user session data.
 */
export function createBaggageFromUser(
  user: { id: string; tier?: string; tenantId?: string },
  flags?: string[]
): BaggageContext {
  return {
    userId: user.id,
    userTier: user.tier || 'standard',
    tenantId: user.tenantId || 'default',
    featureFlags: flags?.join(',') || '',
  };
}