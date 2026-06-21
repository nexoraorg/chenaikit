/**
 * Centralized Error Handling Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { log } from '../utils/logger';
import { captureError } from './errorTracking';
import {
  AppError,
  ValidationError,
  DatabaseError,
  toAppError,
  isAppError
} from '../utils/errors';

/**
 * Main error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  log.error(error.message, {
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  // Send error to Sentry if configured
  if (process.env.SENTRY_DSN) {
    captureError(error, {
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      body: req.body,
      query: req.query,
    });
  }

  // Convert error to AppError if it's not already
  const appError = isAppError(error) ? error : convertToAppError(error);

  // Build error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(isDevelopment && appError.context && { context: appError.context }),
      ...(isDevelopment && {
        stack: appError.stack,
        details: error instanceof ZodError ? formatZodError(error) : undefined,
      }),
      timestamp: new Date().toISOString(),
    },
  };

  res.status(appError.statusCode).json(errorResponse);
}

/**
 * Convert various error types to AppError
 */
function convertToAppError(error: Error): AppError {
  // Zod validation errors
  if (error instanceof ZodError) {
    return new ValidationError('Validation failed', {
      details: formatZodError(error),
    });
  }

  // Prisma database errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new DatabaseError('Unknown database error', {
      originalMessage: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new DatabaseError('Database connection failed', {
      originalMessage: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new DatabaseError('Database internal error', {
      originalMessage: error.message,
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new ValidationError('Invalid token', { originalMessage: error.message });
  }

  if (error.name === 'TokenExpiredError') {
    return new ValidationError('Token expired', { originalMessage: error.message });
  }

  if (error.name === 'NotBeforeError') {
    return new ValidationError('Token not yet valid', { originalMessage: error.message });
  }

  // Default to generic AppError
  return toAppError(error);
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const fields = error.meta?.target as string[] || [];
      return new ValidationError(
        `A record with this ${fields.join(', ')} already exists`,
        { fields, code: error.code }
      );
    }

    case 'P2025':
      // Record not found
      return new ValidationError('Record not found', { code: error.code });

    case 'P2003':
      // Foreign key constraint violation
      return new ValidationError('Invalid reference to related record', {
        code: error.code,
        field: error.meta?.field_name,
      });

    case 'P2014':
      // Required relation violation
      return new ValidationError('Required relation is missing', { code: error.code });

    case 'P2000':
      // Value too long
      return new ValidationError('Value too long for field', { code: error.code });

    case 'P2001':
      // Record does not exist
      return new ValidationError('Record does not exist', { code: error.code });

    case 'P2006':
      // Invalid value for field
      return new ValidationError('Invalid value for field', { code: error.code });

    case 'P2011':
      // Null constraint violation
      return new ValidationError('Required field cannot be null', { code: error.code });

    case 'P2012':
      // Missing required value
      return new ValidationError('Missing required value', { code: error.code });

    case 'P2013':
      // Missing required argument
      return new ValidationError('Missing required argument', { code: error.code });

    case 'P2018':
      // Required connected records not found
      return new ValidationError('Required connected records not found', { code: error.code });

    case 'P2019':
      // Input error
      return new ValidationError('Input error', { code: error.code });

    case 'P2020':
      // Value out of range
      return new ValidationError('Value out of range', { code: error.code });

    case 'P2021':
      // Table does not exist
      return new DatabaseError('Table does not exist in database', { code: error.code });

    case 'P2022':
      // Column does not exist
      return new DatabaseError('Column does not exist in table', { code: error.code });

    case 'P2023':
      // Inconsistent column data
      return new DatabaseError('Inconsistent column data', { code: error.code });

    case 'P2024':
      // Connection pool timeout
      return new DatabaseError('Database connection pool timeout', { code: error.code });

    case 'P2026':
      // Current provider does not support feature
      return new DatabaseError('Database feature not supported', { code: error.code });

    case 'P2027':
      // Multiple errors occurred
      return new DatabaseError('Multiple database errors occurred', { code: error.code });

    case 'P2034':
      // Transaction failed
      return new DatabaseError('Transaction failed due to write conflict', { code: error.code });

    default:
      return new DatabaseError('Database error occurred', {
        code: error.code,
        originalMessage: error.message,
      });
  }
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    },
  });
}
