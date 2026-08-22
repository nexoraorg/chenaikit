import express, { Request, Response, NextFunction } from "express";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { prisma } from "./db.js";

export const app = express();

app.use(express.json());

// Apply rate limiting to all requests
app.use(apiLimiter);

// Health check endpoint (exempt from rate limiting via middleware config)
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "chenaikit-backend" });
});

// API Records endpoint (CRUD fixture for testing API behavior and persistence)
app.get("/api/records", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.apiRecord.findMany();
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

app.post("/api/records", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, value } = req.body ?? {};

    // Validation checks
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        error: "Validation Error",
        message: "Field 'name' is required and must be a non-empty string.",
      });
    }

    if (typeof value !== "number" || isNaN(value)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Field 'value' is required and must be a number.",
      });
    }

    const newRecord = await prisma.apiRecord.create({
      data: { name: name.trim(), value },
    });

    res.status(201).json({ success: true, data: newRecord });
  } catch (error) {
    next(error);
  }
});

// Route triggering persistence / internal error (for 5xx testing)
app.get("/api/trigger-error", async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    // Intentional throw or Prisma operation on broken connection/table
    throw new Error("Database persistence error simulated");
  } catch (error) {
    next(error);
  }
});

// Error handling middleware providing diagnostic response context
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const isDevOrTest = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred",
    context: {
      path: req.path,
      method: req.method,
      stack: isDevOrTest ? err.stack : undefined,
    },
  });
});
