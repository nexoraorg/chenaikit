/**
 * Validation Utilities
 *
 * Reusable helpers that compose Zod schemas with Express middleware,
 * sanitization, and async validation patterns. Used by the validation
 * middleware factory but also available directly for one-off needs.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { log } from './logger';
import { ValidationError as AppValidationError } from './errors';

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Format a ZodError into a flat array of field-level errors suitable for API
 * responses and client-side form libraries.
 */
export function formatZodErrors(error: ZodError): FieldError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Create a human-readable summary from a ZodError.
 */
export function formatZodErrorSummary(error: ZodError): string {
  return error.errors
    .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
    .join('; ');
}

// ---------------------------------------------------------------------------
// Middleware helpers
// ---------------------------------------------------------------------------

/**
 * Create Express middleware that validates `req.body` against a Zod schema.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      return next(
        new AppValidationError('Request body validation failed', { details })
      );
    }
    req.body = result.data;
    next();
  };
}

/**
 * Create Express middleware that validates `req.query` against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      return next(
        new AppValidationError('Query parameter validation failed', { details })
      );
    }
    // Replace query with parsed/coerced values when useful
    req.query = { ...req.query, ...(result.data as Record<string, any>) };
    next();
  };
}

/**
 * Create Express middleware that validates `req.params` against a Zod schema.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      return next(
        new AppValidationError('Path parameter validation failed', { details })
      );
    }
    req.params = { ...req.params, ...(result.data as Record<string, any>) };
    next();
  };
}

/**
 * Create Express middleware that validates headers against a Zod schema.
 */
export function validateHeaders(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.headers);
    if (!result.success) {
      const details = formatZodErrors(result.error);
      return next(
        new AppValidationError('Header validation failed', { details })
      );
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Trim leading / trailing whitespace from every string value in req.body.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, any>;
    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'string') {
        body[key] = body[key].trim();
      }
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Async validators
// ---------------------------------------------------------------------------

/**
 * Wrap an async validation function as Express middleware. The function
 * receives parsed data and should throw AppError on failure.
 */
export function asyncValidator<T>(
  schema: ZodSchema<T>,
  validate: (data: T, req: Request) => Promise<void>
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      await validate(parsed, req);
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Schema composition helpers
// ---------------------------------------------------------------------------

/**
 * Create middleware that validates body, query, and params in one shot.
 * Returns early with the first failure.
 */
export function validateRequest(opts: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

  if (opts.params) middlewares.push(validateParams(opts.params));
  if (opts.query) middlewares.push(validateQuery(opts.query));
  if (opts.body) middlewares.push(validateBody(opts.body));
  if (opts.headers) middlewares.push(validateHeaders(opts.headers));

  return (req: Request, res: Response, next: NextFunction) => {
    let idx = 0;

    const run = (err?: any) => {
      if (err) return next(err);
      if (idx >= middlewares.length) return next();
      try {
        middlewares[idx]!(req, res, run);
        idx++;
      } catch (e) {
        next(e);
      }
    };

    run();
  };
}
