import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError, mapPrismaError } from "../errors/index.js";

export interface ErrorBody {
  error: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export function buildErrorBody(err: AppError, requestId?: string): ErrorBody {
  return {
    error: err.code,
    message: err.message,
    ...(requestId ? { requestId } : {}),
    ...(err.details ? { details: err.details } : {}),
  };
}

interface ErrorLogEvent {
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  /** The original error, stack and all — for server-side logging only, never sent to the client. */
  error: unknown;
}

export interface ErrorHandlerOptions {
  /** Injectable for tests and alternate log sinks; defaults to console.error. */
  log?: (event: ErrorLogEvent) => void;
}

function defaultLog(event: ErrorLogEvent): void {
  const { error, ...meta } = event;
  console.error(
    `[error] ${meta.method} ${meta.path} -> ${meta.statusCode}${meta.requestId ? ` (request ${meta.requestId})` : ""}`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
}

/**
 * Builds the final Express error-handling middleware. Must be mounted after
 * every route (and after notFoundHandler) — Express recognises an error
 * middleware by its four-argument signature.
 *
 * - AppError (or an error mappable to one, e.g. a known Prisma error): the
 *   error's own stable code/message/status is returned as-is.
 * - Anything else is treated as unexpected: the full error is logged
 *   server-side (stack included) and the client gets a generic, safe body
 *   with a request ID for support/log correlation — never the raw error.
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const log = options.log ?? defaultLog;

  return function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
    // Delegate to Express's default handler once headers are already sent —
    // it's unsafe to write a new response body at that point.
    if (res.headersSent) {
      next(err);
      return;
    }

    const known = err instanceof AppError ? err : mapPrismaError(err);

    if (known) {
      log({ requestId: req.id, method: req.method, path: req.path, statusCode: known.statusCode, error: err });
      res.status(known.statusCode).json(buildErrorBody(known, req.id));
      return;
    }

    const requestId = req.id ?? randomUUID();
    log({ requestId, method: req.method, path: req.path, statusCode: 500, error: err });
    res.status(500).json({
      error: "internal_error",
      message: "An unexpected error occurred. Contact support with the request ID below if this persists.",
      requestId,
    });
  };
}

/** Default instance, wired into the app in index.ts. Use createErrorHandler() directly to inject a custom logger (e.g. in tests). */
export const errorHandler = createErrorHandler();
