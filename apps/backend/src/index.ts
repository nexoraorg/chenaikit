// apps/backend — API service entrypoint
// Moved fresh from the old standalone `backend/` per issue #286.
// Wire real routes/Prisma client here as the migration proceeds.

import express from "express";
import { PrismaClient } from "@prisma/client";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { requestId } from "./middleware/requestId.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createGracefulShutdown, registerShutdownSignals } from "./lifecycle.js";

const app = express();
const port = process.env.PORT ?? 3001;
const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);

const prisma = new PrismaClient();

// Assign a request ID before anything else, so it's available to every
// downstream middleware, route, and the error handler.
app.use(requestId);

// Apply rate limiting to all requests
app.use(apiLimiter);

// Health check endpoint (exempt from rate limiting via middleware config)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chenaikit-backend" });
});

// Centralized error handling: notFoundHandler catches unmatched routes,
// errorHandler is the final middleware (four-argument signature required by
// Express to be recognised as an error handler) and must stay last.
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
});

const shutdown = createGracefulShutdown({
  server,
  disconnect: () => prisma.$disconnect(),
  timeoutMs: shutdownTimeoutMs,
});

registerShutdownSignals(shutdown);

export { app, server, prisma };
