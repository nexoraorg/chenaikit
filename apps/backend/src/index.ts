// apps/backend — API service entrypoint
// Moved fresh from the old standalone `backend/` per issue #286.
// Wire real routes/Prisma client here as the migration proceeds.

import express from "express";
import { PrismaClient } from "@prisma/client";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { createGracefulShutdown, registerShutdownSignals } from "./lifecycle.js";

const app = express();
const port = process.env.PORT ?? 3001;
const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);

const prisma = new PrismaClient();

// Apply rate limiting to all requests
app.use(apiLimiter);

// Health check endpoint (exempt from rate limiting via middleware config)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chenaikit-backend" });
});

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
