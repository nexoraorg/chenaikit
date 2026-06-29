import * as Sentry from "@sentry/node";
import {
  httpIntegration,
  expressIntegration,
  expressErrorHandler,
} from "@sentry/node";
import { Request, Response, NextFunction } from "express";

export function initSentry(
  dsn: string,
  environment: string = "production",
): void {
  const integrations: any[] = [httpIntegration(), expressIntegration()];
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    integrations,
  });
}

// For backward compatibility, these functions can return no-ops or be simplified
export function sentryRequestHandler() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export function sentryTracingHandler() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export function sentryErrorHandler(): any {
  return expressErrorHandler();
}

export function errorTrackingMiddleware(
  err: Error,
  req: Request,
  res: Response,
): void {
  Sentry.captureException(err, {
    user: { id: req.user?.id },
    tags: {
      path: req.path,
      method: req.method,
    },
    extra: {
      body: req.body,
      query: req.query,
    },
  });

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

export function captureError(
  error: Error,
  context?: Record<string, any>,
): void {
  Sentry.captureException(error, { extra: context });
}
