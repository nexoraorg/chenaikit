// apps/backend — API service entrypoint
// Moved fresh from the old standalone `backend/` per issue #286.
// Wire real routes/Prisma client here as the migration proceeds.

import express from "express";
import { apiLimiter } from "./middleware/rateLimiter.js";

const app = express();
const port = process.env.PORT ?? 3001;

// Apply rate limiting to all requests
app.use(apiLimiter);

// Health check endpoint (exempt from rate limiting via middleware config)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chenaikit-backend" });
});

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
});
