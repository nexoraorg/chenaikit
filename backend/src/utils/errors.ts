/**
 * Custom Error Classes for Comprehensive Error Handling
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', context?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', true, context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, context);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Authorization failed', context?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, context);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, 404, 'NOT_FOUND', true, context);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', context?: Record<string, any>) {
    super(message, 409, 'CONFLICT_ERROR', true, context);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, context);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', context?: Record<string, any>) {
    super(message, 500, 'DATABASE_ERROR', true, context);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', context?: Record<string, any>) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, context);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error', context?: Record<string, any>) {
    super(message, 500, 'CONFIGURATION_ERROR', true, context);
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Helper function to determine if an error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper function to convert unknown errors to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', true);
  }

  if (typeof error === 'string') {
    return new AppError(error, 500, 'INTERNAL_ERROR', true);
  }

  return new AppError('An unknown error occurred', 500, 'INTERNAL_ERROR', true);
}
