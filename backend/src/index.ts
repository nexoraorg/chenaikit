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
import authRoutes from './routes/auth';
import { UserPayload } from './types/auth';
import { ensureRedisConnection } from './config/redis';
import accountRoutes from './routes/accounts';
import fileRoutes from './routes/files';
import { PrismaClient } from '@prisma/client';
import { FileStorageService } from './services/fileStorageService';
import { ApiKeyService } from './services/apiKeyService';
import { UsageTrackingService } from './services/usageTrackingService';
import { ApiGateway } from './middleware/apiGateway';
import { createTieredRateLimiter } from './middleware/advancedRateLimiter';
import Redis from 'ioredis';
import { applySecurityMiddleware } from './middleware/security';
import { loadVaultSecrets } from './config/secrets';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: express.Application = express();

applySecurityMiddleware(app);
app.use(express.json({ limit: '10mb' }));
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);
app.use('/api', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/files', fileRoutes);
// app.use('/api/v1/analytics', createAnalyticsRouter(prisma, typeorm));

// Gateway-protected endpoints
app.get('/api/v1/credit-score', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      score: Math.floor(Math.random() * 850) + 150,
      factors: ['payment_history', 'credit_utilization', 'account_age'],
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/api/v1/fraud/detect', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      riskScore: Math.floor(Math.random() * 100),
      riskLevel: 'low',
      factors: ['transaction_amount', 'location', 'device'],
      timestamp: new Date().toISOString(),
    },
  });
});

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
  
  // Initialize file storage service and set it on app
  const fileStorageService = new FileStorageService(prisma);
  app.set('fileStorageService', fileStorageService);

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

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const server = app.listen(PORT, async () => {
    console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
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
