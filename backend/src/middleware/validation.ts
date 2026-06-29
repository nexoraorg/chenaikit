/**
 * Request Validation Middleware (Zod-based)
 *
 * Provides a `validate` middleware factory and a `ValidationComposer` class
 * for composing multiple schema validators (body, query, params, headers)
 * into a single Express middleware. Backward-compatible static methods are
 * retained for existing routes that cannot be changed yet.
 *
 * Usage
 * -----
 * ```ts
 * import { validate } from '../middleware/validation';
 * import { createAccountBodySchema, accountIdParamsSchema, paginationQuerySchema } from '../schemas';
 *
 * router.post('/', validate({ body: createAccountBodySchema }), controller.create);
 * router.get('/:id', validate({ params: accountIdParamsSchema }), controller.get);
 * router.get('/:id/transactions', validate({ params: accountIdParamsSchema, query: paginationQuerySchema }), controller.transactions);
 * ```
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import {
  formatZodErrors,
  sanitizeBody,
  FieldError,
} from '../utils/validationUtils';
import { getValidationConfig, ValidationConfig } from '../config/validation';
import { ValidationError } from '../utils/errors';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationSchemaMap {
  /** Schema applied against `req.body`. Parsed result replaces `req.body`. */
  body?: ZodSchema;
  /** Schema applied against `req.query`. */
  query?: ZodSchema;
  /** Schema applied against `req.params`. */
  params?: ZodSchema;
  /** Schema applied against `req.headers`. */
  headers?: ZodSchema;
}

// ---------------------------------------------------------------------------
// Core factory
// ---------------------------------------------------------------------------

/**
 * Create an Express validation middleware from a set of Zod schemas.
 *
 * Schemas are evaluated in order: params → query → body → headers.
 * On failure the middleware calls `next()` with a `ValidationError` so the
 * global error handler can produce a consistent response.
 *
 * When `config.stripUnknown` is true, unknown keys are stripped from the
 * parsed value so only the schema-defined shape reaches the route handler.
 */
export function validate(schemas: ValidationSchemaMap) {
  const config: ValidationConfig = getValidationConfig();

  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // 1. Params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          return fail(result.error, 'Path parameter validation failed', config, next);
        }
        req.params = Object.assign(req.params, result.data as Record<string, any>);
      }

      // 2. Query
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          return fail(result.error, 'Query parameter validation failed', config, next);
        }
        // Merge parsed values back so controllers see coerced numbers / dates
        Object.assign(req.query, result.data as Record<string, any>);
      }

      // 3. Body (skip for GET/HEAD/DELETE which shouldn't have a body)
      if (schemas.body && !['GET', 'HEAD', 'DELETE'].includes(req.method)) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          return fail(result.error, 'Request body validation failed', config, next);
        }
        req.body = result.data;
      }

      // 4. Headers
      if (schemas.headers) {
        const result = schemas.headers.safeParse(req.headers);
        if (!result.success) {
          return fail(result.error, 'Header validation failed', config, next);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ---------------------------------------------------------------------------
// Composer (fluent API)
// ---------------------------------------------------------------------------

/**
 * Fluent builder for composing validation middleware step by step.
 *
 * ```ts
 * validateBuilder
 *   .params(accountIdParamsSchema)
 *   .query(paginationQuerySchema)
 *   .sanitize()
 *   .build()
 * ```
 */
export class ValidationComposer {
  private schemas: ValidationSchemaMap = {};
  private sanitize: boolean = false;

  params(schema: ZodSchema): this {
    this.schemas.params = schema;
    return this;
  }

  query(schema: ZodSchema): this {
    this.schemas.query = schema;
    return this;
  }

  body(schema: ZodSchema): this {
    this.schemas.body = schema;
    return this;
  }

  headers(schema: ZodSchema): this {
    this.schemas.headers = schema;
    return this;
  }

  withSanitization(): this {
    this.sanitize = true;
    return this;
  }

  build(): Array<(req: Request, res: Response, next: NextFunction) => void> {
    const stack: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
    if (this.sanitize) stack.push(sanitizeBody);
    stack.push(validate(this.schemas));
    return stack;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(
  error: ZodError,
  message: string,
  config: ValidationConfig,
  next: NextFunction,
): void {
  const details: FieldError[] = formatZodErrors(error);

  if (config.logValidationErrors) {
    log.warn('Validation failed', {
      message,
      errors: details.map((d) => `${d.field}: ${d.message}`).join('; '),
    });
  }

  next(new ValidationError(message, { details }));
}

// ---------------------------------------------------------------------------
// Legacy static methods (backward-compatible, used by non-migrated routes)
// ---------------------------------------------------------------------------

export class ValidationMiddleware {
  static validateAccountId(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Account ID is required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!/^[A-Za-z0-9]{1,56}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid account ID format',
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  }

  static validateAccountCreation(req: Request, res: Response, next: NextFunction) {
    const { name, email, publicKey } = req.body;
    const errors: { field: string; message: string }[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
    } else if (name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be 100 characters or less' });
    }

    if (!email || typeof email !== 'string') {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }

    if (!publicKey || typeof publicKey !== 'string') {
      errors.push({ field: 'publicKey', message: 'Public key is required' });
    } else if (!/^G[A-Z2-7]{55}$/.test(publicKey)) {
      errors.push({
        field: 'publicKey',
        message:
          'Invalid Stellar public key format. Must start with G and be 56 characters total using Base32 alphabet (A-Z, 2-7)',
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  }

  static validatePagination(req: Request, res: Response, next: NextFunction) {
    const { page, limit, sortBy, sortOrder } = req.query;
    const errors: { field: string; message: string }[] = [];

    if (page && (isNaN(Number(page)) || Number(page) < 1)) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }

    if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
    }

    if (sortBy && !['timestamp', 'amount'].includes(sortBy as string)) {
      errors.push({ field: 'sortBy', message: 'Sort by must be either "timestamp" or "amount"' });
    }

    if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
      errors.push({ field: 'sortOrder', message: 'Sort order must be either "asc" or "desc"' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  }

  static sanitizeInput(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, any>;
      for (const key in body) {
        if (typeof body[key] === 'string') {
          body[key] = (body[key] as string).trim();
        }
      }
    }
    next();
  }
}
