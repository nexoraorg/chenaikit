/**
 * Base class for errors the application raises deliberately (as opposed to
 * unexpected/unknown failures). Every AppError carries a stable,
 * machine-readable `code` and an HTTP-safe `message` that is safe to send to
 * a client as-is — never raw database errors, stack traces, or internal
 * details.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  /** Optional safe, structured extra context (e.g. which field failed validation). */
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request could not be validated.", details?: Record<string, unknown>) {
    super("validation_error", message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super("unauthorized", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("forbidden", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super("not_found", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current state of the resource.", details?: Record<string, unknown>) {
    super("conflict", message, 409, details);
    this.name = "ConflictError";
  }
}

/**
 * A database operation failed in a way we recognise (e.g. a Prisma error we
 * don't have a more specific mapping for) but don't want to expose details
 * of to the client. The underlying error is always logged server-side by
 * the error handler; this class exists so the response stays generic and
 * safe regardless of what the database actually said.
 */
export class DatabaseError extends AppError {
  constructor(message = "A database error occurred.") {
    super("database_error", message, 500);
    this.name = "DatabaseError";
  }
}
