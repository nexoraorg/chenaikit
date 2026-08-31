import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { mapPrismaError } from "./mapPrismaError.js";
import { ConflictError, DatabaseError, NotFoundError, ValidationError } from "./AppError.js";

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("Prisma internal message with table/column detail", {
    code,
    clientVersion: "5.22.0",
    meta,
  });
}

describe("mapPrismaError", () => {
  it("maps a unique constraint violation (P2002) to a 409 ConflictError with a safe message", () => {
    const mapped = mapPrismaError(knownError("P2002", { target: ["email"] }));
    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped?.statusCode).toBe(409);
    expect(mapped?.code).toBe("conflict");
    expect(mapped?.message).not.toMatch(/prisma internal/i);
  });

  it("maps a record-not-found (P2025) to a 404 NotFoundError", () => {
    const mapped = mapPrismaError(knownError("P2025"));
    expect(mapped).toBeInstanceOf(NotFoundError);
    expect(mapped?.statusCode).toBe(404);
  });

  it("maps a foreign key violation (P2003) to a 400 ValidationError", () => {
    const mapped = mapPrismaError(knownError("P2003"));
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped?.statusCode).toBe(400);
  });

  it("falls back to a generic 500 DatabaseError for a recognised-but-unmapped code, never leaking the raw message", () => {
    const mapped = mapPrismaError(knownError("P2034"));
    expect(mapped).toBeInstanceOf(DatabaseError);
    expect(mapped?.statusCode).toBe(500);
    expect(mapped?.message).not.toMatch(/prisma internal/i);
  });

  it("maps a validation error to a 400 ValidationError", () => {
    const mapped = mapPrismaError(new Prisma.PrismaClientValidationError("some raw zod-ish prisma text", { clientVersion: "5.22.0" }));
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped?.statusCode).toBe(400);
  });

  it("returns null for a plain, non-Prisma error", () => {
    expect(mapPrismaError(new Error("boom"))).toBeNull();
    expect(mapPrismaError("not even an error")).toBeNull();
  });
});
