import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { requestId } from "./requestId.js";
import { asyncHandler } from "./asyncHandler.js";
import { notFoundHandler } from "./notFoundHandler.js";
import { createErrorHandler } from "./errorHandler.js";
import { ValidationError, NotFoundError, ConflictError } from "../errors/index.js";

describe("centralized error handling", () => {
  let app: express.Application;
  let log: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    log = vi.fn();
    app = express();
    app.use(express.json());
    app.use(requestId);

    app.get("/known/validation", () => {
      throw new ValidationError("The 'amount' field must be a positive number.", { field: "amount" });
    });
    app.get("/known/not-found", () => {
      throw new NotFoundError("No creator with that address.");
    });
    app.get("/known/conflict", () => {
      throw new ConflictError("A record with this email already exists.");
    });
    app.get(
      "/known/prisma-unique",
      asyncHandler(async () => {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["email"] },
        });
      }),
    );
    app.get(
      "/unknown/async",
      asyncHandler(async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'foo')");
      }),
    );
    app.get("/unknown/sync", () => {
      throw new Error("something truly unexpected");
    });
    app.get("/ok", (_req, res) => {
      res.json({ ok: true });
    });

    app.use(notFoundHandler);
    app.use(createErrorHandler({ log }));
  });

  it("returns a stable status code and safe body for a known validation error", async () => {
    const res = await request(app).get("/known/validation");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "validation_error",
      message: "The 'amount' field must be a positive number.",
      requestId: expect.any(String),
      details: { field: "amount" },
    });
  });

  it("returns a stable status code for a known not-found error", async () => {
    const res = await request(app).get("/known/not-found");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("returns a stable status code for a known conflict error", async () => {
    const res = await request(app).get("/known/conflict");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("conflict");
  });

  it("maps a known Prisma error (thrown from an async handler) to its safe status/code", async () => {
    const res = await request(app).get("/known/prisma-unique");
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("conflict");
    expect(JSON.stringify(res.body)).not.toMatch(/unique constraint failed/i);
  });

  it("returns a generic 500 with a request ID for an unexpected async error, without leaking the message or a stack trace", async () => {
    const res = await request(app).get("/unknown/async");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("internal_error");
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toMatch(/Cannot read properties/i);
  });

  it("returns a generic 500 with a request ID for an unexpected synchronous error", async () => {
    const res = await request(app).get("/unknown/sync");
    expect(res.status).toBe(500);
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/something truly unexpected/i);
  });

  it("logs the full error server-side (stack included) for an unexpected failure", async () => {
    await request(app).get("/unknown/sync");
    expect(log).toHaveBeenCalledTimes(1);
    const event = log.mock.calls[0][0];
    expect(event.statusCode).toBe(500);
    expect(event.error).toBeInstanceOf(Error);
    expect(event.error.stack).toContain("something truly unexpected");
  });

  it("logs known errors too, with their real status code", async () => {
    await request(app).get("/known/not-found");
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it("reuses an inbound X-Request-Id and echoes it back on both success and error responses", async () => {
    const ok = await request(app).get("/ok").set("X-Request-Id", "trace-abc-123");
    expect(ok.headers["x-request-id"]).toBe("trace-abc-123");

    const failed = await request(app).get("/unknown/sync").set("X-Request-Id", "trace-xyz-789");
    expect(failed.body.requestId).toBe("trace-xyz-789");
  });

  it("returns a stable 404 shape for a route that doesn't exist, instead of Express's default HTML page", async () => {
    const res = await request(app).get("/this/route/does/not/exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});
