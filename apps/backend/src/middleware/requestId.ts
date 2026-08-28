import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Assigns a stable request ID to every request — reused from an inbound
 * `X-Request-Id` header when a caller (e.g. a gateway) already set one, so
 * a trace stays correlated end to end. Set early, before routes, so it's
 * available to logging and to the error handler regardless of where a
 * request fails.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  req.id = (typeof inbound === "string" && inbound.trim()) || randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}
