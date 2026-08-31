import { Prisma } from "@prisma/client";
import { AppError, ConflictError, DatabaseError, NotFoundError, ValidationError } from "./AppError.js";

/**
 * Maps a Prisma error to the equivalent AppError, so known database failure
 * modes get a stable status code and a safe message instead of leaking
 * Prisma's internal error text (which can include table/column names and
 * raw query fragments) to the client.
 *
 * Returns null for anything that isn't a Prisma error — callers should
 * treat that as "not a known database error" and fall through to the
 * generic unexpected-error path.
 */
export function mapPrismaError(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint violation.
      case "P2002": {
        const target = Array.isArray(err.meta?.target) ? err.meta?.target.join(", ") : undefined;
        return new ConflictError(
          target ? `A record with this ${target} already exists.` : "A record with these values already exists.",
        );
      }
      // Record not found (e.g. update/delete on a missing row).
      case "P2025":
        return new NotFoundError("The requested resource was not found.");
      // Foreign key constraint violation.
      case "P2003":
        return new ValidationError("The request refers to a related resource that does not exist.");
      // Required relation/value missing.
      case "P2011":
      case "P2012":
        return new ValidationError("A required value is missing.");
      default:
        return new DatabaseError();
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError("The request could not be validated.");
  }

  if (
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new DatabaseError();
  }

  return null;
}
