// apps/backend — API service entrypoint (placeholder)
// Moved fresh from the old standalone `backend/` per issue #286.
// Wire real routes/Prisma client here as the migration proceeds.

import express from "express";

const app = express();
const port = process.env.PORT ?? 3001;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "chenaikit-backend" });
});

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
});
