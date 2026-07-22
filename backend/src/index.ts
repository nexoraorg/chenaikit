// ChenAIKit Backend Server
import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

// Initialize OpenTelemetry tracing FIRST (before any other imports)
// This ensures all instrumentations can hook into modules at load time.
import { initializeTracing, shutdownTracing } from './tracing/tracer';
import { TracingConfig } from './tracing/tracer';

const tracingEnabled = process.env.TRACING_ENABLED === 'true' || process.env.OTEL_ENABLED === 'true';

if (tracingEnabled) {
  const tracingConfig: TracingConfig = {
    serviceName: process.env.SERVICE_NAME || 'chenaikit-backend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    sampleRate: Number(process.env.TRACE_SAMPLE_RATE) || 0.01,
    errorSampleRate: 1.0,
    maxTracesPerMinute: Number(process.env.MAX_TRACES_PER_MINUTE) || 1000,
  };

  initializeTracing(tracingConfig).catch((err) => {
    console.error('Failed to initialize OpenTelemetry tracing:', err);
  });
}

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
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDistributedRateLimiter } from './middleware/distributedRateLimiter';
import { getHealthService } from './services/healthService';
import { applyCompressionMiddleware, compressionRequestErrorHandler } from './middleware/compression';

// Tracing middleware
import { baggagePropagationMiddleware } from './tracing/baggage';
import { tracingCorrelationMiddleware } from './tracing/correlation';

const app: express.Application = express();

applySecurityMiddleware(app);
applyCompressionMiddleware(app);
app.use(express.json({ limit: '10mb' }));
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);

// Tracing middleware - add baggage propagation and trace correlation
if (tracingEnabled) {
  app.use(baggagePropagationMiddleware);
  app.use(tracingCorrelationMiddleware);
}

app.use('/api', getDistributedRateLimiter().middleware());
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
app.use(compressionRequestErrorHandler);
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

  // registerGatewayRoutes(apiGateway, apiKeyService, usageTrackingService);
  const healthService = getHealthService(prisma);
  healthService.startMonitoring();

  const PORT = process.env.PORT || 5000;

  await initializeMonitoring();

  const shutdown = async () => {
    try {
      healthService.stopMonitoring();
      await shutdownMonitoring();
      // Shutdown OpenTelemetry tracing
      if (tracingEnabled) {
        await shutdownTracing();
      }
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
    console.log(`🔍 Tracing:       ${tracingEnabled ? 'enabled' : 'disabled'}`);
    console.log(`📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);

    try {
      await ensureRedisConnection();
      console.log('🧠 Redis cache ready');
    } catch (_err) {
      console.warn('⚠️  Redis not available. Continuing without cache.');
    }
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

export default app;