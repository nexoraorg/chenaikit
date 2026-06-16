// ChenAIKit Backend Server
import "reflect-metadata";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { log } from "./utils/logger";
import { requestLoggingMiddleware } from "./middleware/logging";
import healthRouter from "./routes/health";
import { metricsService, metricsMiddleware } from "./services/metricsService";
import {
  validateEnvironment,
  initializeMonitoring,
  shutdownMonitoring,
} from "./config/monitoring";
import authRoutes from "./routes/auth";
import { UserPayload } from "./types/auth";
import { ensureRedisConnection } from "./config/redis";
import accountRoutes from "./routes/accounts";
import { PrismaClient } from "@prisma/client";
import { ApiKeyService } from "./services/apiKeyService";
import { UsageTrackingService } from "./services/usageTrackingService";
import { ApiGateway } from "./middleware/apiGateway";
import { createTieredRateLimiter } from "./middleware/advancedRateLimiter";
import Redis from "ioredis";
import { applySecurityMiddleware } from "./middleware/security";
import { loadVaultSecrets } from "./config/secrets";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec, swaggerUiOptions, jsonToYaml } from "./config/swagger";
import { validateRequestAgainstSpec } from "./middleware/swaggerValidator";

const app: express.Application = express();

applySecurityMiddleware(app);
app.use(express.json({ limit: "10mb" }));
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);

// Swagger UI - interactive API documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerUiOptions),
);

// Raw OpenAPI spec endpoint (JSON)
app.get("/api-docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Raw OpenAPI spec endpoint (YAML)
app.get("/api-docs.yaml", (_req: Request, res: Response) => {
  // Convert JSON spec to YAML format
  const yaml = jsonToYaml(swaggerSpec);
  res.setHeader("Content-Type", "text/yaml");
  res.send(yaml);
});

// Validate request bodies against OpenAPI spec
app.use(validateRequestAgainstSpec);

app.use("/api", healthRouter);
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
// app.use('/api/v1/analytics', createAnalyticsRouter(prisma, typeorm));

// Gateway-protected endpoints
/**
 * @openapi
 * /api/v1/credit-score:
 *   get:
 *     summary: Get credit score
 *     description: Returns an AI-generated credit score with contributing factors. Gateway-protected endpoint.
 *     tags: [Credit Scoring]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit score computed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditScoreResponse'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
app.get("/api/v1/credit-score", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      score: Math.floor(Math.random() * 850) + 150,
      factors: ["payment_history", "credit_utilization", "account_age"],
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @openapi
 * /api/v1/fraud/detect:
 *   get:
 *     summary: Detect fraud risk
 *     description: Returns a fraud risk assessment with risk score, level, and contributing factors. Gateway-protected endpoint.
 *     tags: [Fraud Detection]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fraud detection result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FraudDetectionResponse'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
app.get("/api/v1/fraud/detect", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      riskScore: Math.floor(Math.random() * 100),
      riskLevel: "low",
      factors: ["transaction_amount", "location", "device"],
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Exposes application metrics in Prometheus text format for scraping.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Prometheus-formatted metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Failed to collect metrics
 */
app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set("Content-Type", "text/plain");
    res.send(metrics);
  } catch (e: unknown) {
    const error = e as Error;
    res.status(500).send(error?.message || "metrics error");
  }
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ENDPOINT_NOT_FOUND",
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", error);

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export const startServer = async (): Promise<void> => {
  // Load environment variables
  dotenv.config();

  // Optional: load secrets from Vault before validating environment
  await loadVaultSecrets();

  // Validate environment configuration
  validateEnvironment();

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const apiKeyService = new ApiKeyService(prisma);
  const usageTrackingService = new UsageTrackingService(prisma);
  const rateLimiter = createTieredRateLimiter(redis);
  const apiGateway = new ApiGateway(
    apiKeyService,
    usageTrackingService,
    rateLimiter,
  );

  // registerGatewayRoutes(apiGateway, apiKeyService, usageTrackingService);

  const PORT = process.env.PORT || 5000;

  await initializeMonitoring();

  const shutdown = async () => {
    try {
      await shutdownMonitoring();
      await redis.quit();
      await prisma.$disconnect();
    } catch {
      /* noop */
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const server = app.listen(PORT, async () => {
    console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
    console.log(`📖 API Docs:      http://localhost:${PORT}/api-docs`);
    console.log(`📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);

    try {
      await ensureRedisConnection();
      console.log("🧠 Redis cache ready");
    } catch (_err) {
      console.warn("⚠️  Redis not available. Continuing without cache.");
    }
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}

export default app;
