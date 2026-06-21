import { Request, Response, NextFunction } from 'express';
import { log, Timer } from '../utils/logger';
import { redactBody, redactHeaders } from '../utils/logRedaction';
import { LogContext } from '../types/monitoring';

// Re-export requestIdMiddleware so callers can import from one place
export { requestIdMiddleware } from './requestId';

/**
 * Attaches a request-scoped child logger to req.logger.
 * Must run AFTER requestIdMiddleware so req.id is available.
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.startTime = Date.now();

  req.logger = log.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  req.logger.info('Incoming request', {
    query: req.query,
    body: redactBody(req.body),
    headers: redactHeaders(req.headers as Record<string, unknown>),
  });

  const originalSend = res.send.bind(res);
  res.send = function (data): Response {
    res.send = originalSend;

    const duration = Date.now() - req.startTime;
    const context: LogContext = {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    };

    if (res.statusCode >= 500) {
      req.logger.error('Request failed with server error', context);
    } else if (res.statusCode >= 400) {
      req.logger.warn('Request failed with client error', context);
    } else {
      req.logger.info('Request completed', context);
    }

    return originalSend(data);
  };

  next();
};

/**
 * Logs unhandled errors and forwards them to the next error handler.
 */
export const errorLoggingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = req.logger || log;
  logger.error('Unhandled error', err instanceof Error ? err : undefined, {
    statusCode: err.statusCode || 500,
    code: err.code,
    duration: req.startTime ? Date.now() - req.startTime : undefined,
  });
  next(err);
};

/**
 * Emits a performance log when the response finishes.
 */
export const timingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timer = new Timer(`${req.method} ${req.path}`, req.logger);
  res.on('finish', () => timer.end({ statusCode: res.statusCode, success: res.statusCode < 400 }));
  next();
};

/**
 * Warns when a request exceeds the given threshold (default 5 s).
 */
export const slowRequestMiddleware = (thresholdMs = 5000) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      req.logger?.warn('Slow request detected', {
        duration: Date.now() - req.startTime,
        threshold: thresholdMs,
        method: req.method,
        path: req.path,
      });
    }, thresholdMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };

/**
 * Enriches req.logger with authenticated-user context.
 * Place this after your auth middleware.
 */
export const userContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;
  if (user && req.logger) {
    req.logger = req.logger.child({
      userId: user.id,
      userRole: user.role,
    });
  }
  next();
};

/**
 * Audit-log middleware: emits an audit entry for every mutating request (POST/PUT/PATCH/DELETE).
 * Place after userContextMiddleware so userId is in scope.
 */
export const auditLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    (req.logger || log).audit(req.method, {
      requestId: req.id,
      path: req.path,
      statusCode: res.statusCode,
      userId: (req as any).user?.id,
      duration: req.startTime ? Date.now() - req.startTime : undefined,
    });
  });

  next();
};

/**
 * Convenience array: attach all logging middlewares in the correct order.
 * requestIdMiddleware must have been applied before this stack.
 */
export const loggingMiddlewares = [
  requestLoggingMiddleware,
  timingMiddleware,
  slowRequestMiddleware(),
  auditLoggingMiddleware,
];
