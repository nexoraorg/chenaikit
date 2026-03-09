import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

export function initSentry(dsn: string, environment: string = 'production'): void {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: undefined as any })
    ]
  });
}

export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

export function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

export function errorTrackingMiddleware(
  err: Error,
  req: Request,
  res: Response
): void {
  Sentry.captureException(err, {
    user: { id: req.user?.id },
    tags: {
      path: req.path,
      method: req.method
    },
    extra: {
      body: req.body,
      query: req.query
    }
  });

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

export function captureError(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, { extra: context });
}
