import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so a rejected promise reaches the centralized
 * error handler via `next(err)`. Express 4 does not do this automatically —
 * an unhandled rejection in an async handler would otherwise crash the
 * process instead of producing a safe error response.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
