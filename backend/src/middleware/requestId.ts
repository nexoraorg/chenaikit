import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a unique request ID to every incoming request.
 * Reuses the client-supplied X-Request-Id header when present (for distributed tracing).
 * The ID is echoed back in the response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[REQUEST_ID_HEADER];
  req.id = (Array.isArray(existing) ? existing[0] : existing) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
