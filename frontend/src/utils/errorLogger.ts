export type ErrorType =
  | 'network'
  | 'rendering'
  | 'validation'
  | 'authentication'
  | 'websocket'
  | 'unknown';

export interface ErrorContextPayload {
  type?: ErrorType;
  boundary?: string;
  componentStack?: string;
  route?: string;
  userId?: string | number;
  userEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorReport {
  message: string;
  name: string;
  stack?: string;
  type: ErrorType;
  code: string;
  occurredAt: string;
  context: ErrorContextPayload;
  userAgent: string;
  language: string;
  platform: string;
  url: string;
  viewport: {
    width: number;
    height: number;
  };
}

const DEFAULT_ERROR_ENDPOINT = '/api/errors';

export function classifyError(error: unknown): ErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
    return 'authentication';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  if (message.includes('websocket') || message.includes('socket')) {
    return 'websocket';
  }

  return error instanceof Error ? 'rendering' : 'unknown';
}

export function getErrorCode(type: ErrorType): string {
  const codes: Record<ErrorType, string> = {
    network: 'ERR-NETWORK',
    rendering: 'ERR-RENDER',
    validation: 'ERR-VALIDATION',
    authentication: 'ERR-AUTH',
    websocket: 'ERR-WEBSOCKET',
    unknown: 'ERR-UNKNOWN',
  };

  return codes[type];
}

export function buildErrorReport(error: unknown, context: ErrorContextPayload = {}): ErrorReport {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const type = context.type ?? classifyError(error);

  return {
    message: normalizedError.message || 'Unknown application error',
    name: normalizedError.name || 'Error',
    stack: normalizedError.stack,
    type,
    code: getErrorCode(type),
    occurredAt: new Date().toISOString(),
    context: {
      route: window.location.pathname,
      ...context,
    },
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

export async function logError(error: unknown, context: ErrorContextPayload = {}): Promise<ErrorReport> {
  const report = buildErrorReport(error, context);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[ChenaiKit error]', report);
  }

  try {
    await fetch(process.env.REACT_APP_ERROR_REPORTING_URL || DEFAULT_ERROR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
      keepalive: true,
    });
  } catch (loggingError) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[ChenaiKit error reporting failed]', loggingError);
    }
  }

  return report;
}
