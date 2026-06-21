// ChenAIKit Backend Server
import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Sentry first
import { initSentry, sentryErrorHandler } from './middleware/errorTracking';
if (process.env.SENTRY_DSN) {
  initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV || 'development');
}

import express, { Request, Response } from 'express';
import { log } from './utils/logger';
import { requestLoggingMiddleware } from './middleware/logging';
import healthRouter from './routes/health';
import { metricsService, metricsMiddleware } from './services/metricsService';
import { validateEnvironment, initializeMonitoring, shutdownMonitoring } from './config/monitoring';
import { UserPayload } from './types/auth';
import { ensureRedisConnection } from './config/redis';
import { detectVersion, versionHeaders, createVersionRouter } from './middleware/versioning';
import v1Router from './routes/v1';
import v2Router from './routes/v2';
import { API_VERSIONS, LATEST_VERSION, DEFAULT_VERSION } from './utils/versionUtils';
import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from './services/apiKeyService';
import { UsageTrackingService } from './services/usageTrackingService';
import { ApiGateway } from './middleware/apiGateway';
import { createTieredRateLimiter } from './middleware/advancedRateLimiter';
import Redis from 'ioredis';
import { applySecurityMiddleware } from './middleware/security';
import { loadVaultSecrets } from './config/secrets';
import { createQueryLogger, queryLoggerMiddleware } from './middleware/queryLogger';
import { createQueryOptimizer } from './services/queryOptimizer';
import { startCacheCleanup } from './utils/queryUtils';

const app: express.Application = express();

applySecurityMiddleware(app);
app.use(express.json({ limit: '10mb' }));
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);
// Health checks remain unversioned and must be matched before the version dispatcher.
app.use('/api', healthRouter);

// Version discovery endpoint: lists supported versions and their lifecycle.
app.get('/api/versions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      default: DEFAULT_VERSION,
      latest: LATEST_VERSION,
      versions: API_VERSIONS,
    },
  });
});

// Versioned API surface.
// Supports URL path (/api/v1, /api/v2), header (Accept-Version) and query
// (?version) versioning. Unversioned requests fall back to the default version,
// keeping existing clients working.
app.use(
  '/api',
  detectVersion(),
  versionHeaders(),
  createVersionRouter({ v1: v1Router, v2: v2Router })
);

// Prometheus metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (e: unknown) {
    const error = e as Error;
    res.status(500).send(error?.message || 'metrics error');
  }
});

// 404 handler
app.use('*', notFoundHandler);

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(sentryErrorHandler());
}

// Global error handler
app.use(errorHandler);

export const startServer = async (): Promise<void> => {
  // Load environment variables
  dotenv.config();

  // Optional: load secrets from Vault before validating environment
  await loadVaultSecrets();

  // Validate environment configuration
  validateEnvironment();

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const apiKeyService = new ApiKeyService(prisma);
  const usageTrackingService = new UsageTrackingService(prisma);
  const rateLimiter = createTieredRateLimiter(redis);
  const apiGateway = new ApiGateway(apiKeyService, usageTrackingService, rateLimiter);

  // Initialize query logger and optimizer
  const queryLogger = createQueryLogger(prisma);
  const queryOptimizer = createQueryOptimizer(prisma);
  app.use(queryLoggerMiddleware(queryLogger));

  // Start cache cleanup interval
  startCacheCleanup(60000); // Clean up expired cache entries every minute

  // registerGatewayRoutes(apiGateway, apiKeyService, usageTrackingService);

  const PORT = process.env.PORT || 5000;

  await initializeMonitoring();

  // Add query statistics endpoint
  app.get('/api/query-stats', (_req: Request, res: Response) => {
    const stats = queryLogger.getStatistics();
    const optimizerStats = queryOptimizer.getPerformanceStats();
    res.json({
      queryLogger: stats,
      queryOptimizer: optimizerStats
    });
  });

  const shutdown = async () => {
    try {
      await shutdownMonitoring();
      await redis.quit();
      await prisma.$disconnect();
    } catch {
      /* noop */
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const server = app.listen(PORT, async () => {
    console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
    console.log(`� Query stats:   http://localhost:${PORT}/api/query-stats`);
    console.log(`�📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);

    try {
      await ensureRedisConnection();
      console.log('🧠 Redis cache ready');
    } catch (_err) {
      console.warn('⚠️  Redis not available. Continuing without cache.');
    }

    console.log('🗄️  Query optimization enabled');
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

export default app;
