import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log, Timer } from '../utils/logger';
import { LogContext } from '../types/monitoring';

declare global {
  namespace Express {
    interface Request {
      id: string;
      logger: typeof log;
      startTime: number;
    }
  }
}

/**
 * Request ID middleware - Adds unique ID to each request
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

/**
 * Request logging middleware - Logs all incoming requests
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.startTime = Date.now();

  // Create request-scoped logger
  req.logger = log.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Log incoming request
  req.logger.info('Incoming request', {
    query: req.query,
    body: sanitizeBody(req.body),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data): Response {
    res.send = originalSend;

    const duration = Date.now() - req.startTime;
    const context: LogContext = {
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    };

    // Log response based on status code
    if (res.statusCode >= 500) {
      req.logger.error('Request failed with server error', context);
    } else if (res.statusCode >= 400) {
      req.logger.warn('Request failed with client error', context);
    } else {
      req.logger.info('Request completed', context);
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Error logging middleware - Logs unhandled errors
 */
export const errorLoggingMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = req.logger || log;
  const duration = req.startTime ? Date.now() - req.startTime : undefined;

  logger.error('Unhandled error', err, {
    statusCode: err.statusCode || 500,
    code: err.code,
    duration,
  });

  // Pass error to next error handler
  next(err);
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'authorization',
  ];

  const sanitized = { ...body };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Slow request warning middleware
 */
export const slowRequestMiddleware = (thresholdMs: number = 5000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      const duration = Date.now() - req.startTime;
      req.logger.warn('Slow request detected', {
        duration,
        threshold: thresholdMs,
        method: req.method,
        path: req.path,
      });
    }, thresholdMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

/**
 * API endpoint timing middleware
 */
export const timingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timer = new Timer(`${req.method} ${req.path}` 
, req.logger);

  res.on('finish', () => {
    timer.end({
      statusCode: res.statusCode,
      success: res.statusCode < 400,
    });
  });

  next();
};

/**
 * User context middleware - Adds user info to logger context
 */
export const userContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Assuming you have user info in req.user after authentication
  if ((req as any).user) {
    const user = (req as any).user;
    req.logger = req.logger.child({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
    });
  }

  next();
};

/**
 * Combine all logging middlewares
 */
export const loggingMiddlewares = [
  requestIdMiddleware,
  requestLoggingMiddleware,
  timingMiddleware,
  slowRequestMiddleware(),
];
