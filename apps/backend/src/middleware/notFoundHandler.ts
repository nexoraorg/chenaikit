import type { Request, Response } from "express";
import { NotFoundError } from "../errors/index.js";
import { buildErrorBody } from "./errorHandler.js";

/**
 * Mounted after every route. Anything that reaches this point matched no
 * route, so it gets the same stable 404 shape as an explicit NotFoundError
 * thrown from inside a handler, instead of Express's default HTML page.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = new NotFoundError(`No route matches ${req.method} ${req.path}.`);
  res.status(error.statusCode).json(buildErrorBody(error, req.id));
}
