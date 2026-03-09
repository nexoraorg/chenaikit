// ChenAIKit Backend Server
import 'reflect-metadata';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { log } from './utils/logger';
import { requestLoggingMiddleware } from './middleware/logging';
import healthRouter from './routes/health';
import { metricsService, metricsMiddleware } from './services/metricsService';
import { validateEnvironment, initializeMonitoring, shutdownMonitoring } from './config/monitoring';
import authRoutes from './routes/auth';
import { UserPayload } from './types/auth';
import { ensureRedisConnection } from './config/redis';
import accountRoutes from './routes/accounts';
import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from './services/apiKeyService';
import { UsageTrackingService } from './services/usageTrackingService';
import { ApiGateway } from './middleware/apiGateway';
import { createTieredRateLimiter } from './middleware/advancedRateLimiter';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { createAnalyticsRouter } from './routes/analytics';
import { User } from './models/User';
import { Account } from './models/Account';
import { Transaction } from './models/Transaction';
import { CreditScore } from './models/CreditScore';
import { FraudAlert } from './models/FraudAlert';

// Load environment variables
dotenv.config();

// Validate environment configuration
validateEnvironment();

// Initialize services
const prisma = new PrismaClient();

// In test mode, use a mock Redis to avoid connection hangs
const redis = process.env.NODE_ENV === 'test'
  ? new Redis({ lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false })
  : new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const apiKeyService = new ApiKeyService(prisma);
const usageTrackingService = new UsageTrackingService(prisma);
const rateLimiter = createTieredRateLimiter(redis);

const typeorm = new DataSource({
  type: 'sqljs',
  location: process.env.NODE_ENV === 'test' ? undefined : (process.env.SQLITE_DB_PATH || 'database.sqlite'),
  autoSave: process.env.NODE_ENV !== 'test',
  entities: [User, Account, Transaction, CreditScore, FraudAlert],
  synchronize: true, // Always synchronize in test or development
  logging: false,
});

const apiGateway = new ApiGateway(apiKeyService, usageTrackingService, rateLimiter);

const app: express.Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Add metrics middleware before request logging
app.use(metricsMiddleware);

// Add logging middlewares
app.use(requestLoggingMiddleware);

// Health routes
app.use('/api', healthRouter);

// API Gateway protected routes
const gatewayMiddleware = apiGateway.gateway({
  enableAuth: true,
  enableRateLimit: true,
  enableUsageTracking: true,
  transform: {
    responseHeaders: {
      'X-API-Version': '1.0.0',
      'X-Gateway': 'ChenAIKit-API-Gateway',
    },
  },
});

// Protected API routes with gateway
app.use('/api/v1', ...gatewayMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/v1/analytics', createAnalyticsRouter(prisma, typeorm));

// Gateway-protected endpoints
app.use('/api/v1/credit-score', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      score: Math.floor(Math.random() * 850) + 150,
      factors: ['payment_history', 'credit_utilization', 'account_age'],
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api/v1/fraud/detect', (req: Request, res: Response) => {
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

// API Key management endpoints
app.post('/api/v1/keys', async (req: Request, res: Response) => {
  try {
    const { name, tier = 'FREE', allowedIps, allowedPaths, usageQuota } = req.body;
    const user = req.user as UserPayload | undefined;
    
    const { apiKey, plainKey } = await apiKeyService.createApiKey({
      name,
      tier,
      userId: user?.id || undefined,
      allowedIps,
      allowedPaths,
      usageQuota,
    });

    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          tier: apiKey.tier,
          key: plainKey, // Only shown once
          createdAt: apiKey.createdAt,
        },
      },
    });
  } catch (err) {
    const error = err as Error;
    log.error('API key creation failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_CREATION_FAILED',
        message: 'Failed to create API key',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

app.get('/api/v1/keys', async (req: Request, res: Response) => {
  try {
    const user = req.user as UserPayload | undefined;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date().toISOString(),
        },
      });
    }
    const apiKeys = await apiKeyService.getApiKeysByUserId(user.id);
    
    res.json({
      success: true,
      data: {
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          tier: key.tier,
          isActive: key.isActive,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          currentUsage: key.currentUsage,
          usageQuota: key.usageQuota,
        })),
      },
    });
  } catch (err) {
    const error = err as Error;
    log.error('API keys fetch failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEYS_FETCH_FAILED',
        message: 'Failed to fetch API keys',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

app.get('/api/v1/analytics', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    
    const analytics = await usageTrackingService.getAnalytics(startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    const error = err as Error;
    log.error('Analytics fetch failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_FETCH_FAILED',
        message: 'Failed to fetch analytics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

app.get('/api/v1/gateway/health', async (req: Request, res: Response) => {
  try {
    const health = await apiGateway.healthCheck();
    res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    const error = err as Error;
    log.error('Gateway health check failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GATEWAY_HEALTH_CHECK_FAILED',
        message: 'Failed to get gateway health',
        timestamp: new Date().toISOString(),
      },
    });
  }
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
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
});

// Initialize services and start server
const startServer = async () => {
  try {
    validateEnvironment();
    await initializeMonitoring();
    
    await typeorm.initialize();
    console.log('📦 TypeORM initialized');

    try {
      await ensureRedisConnection();
      console.log('🧠 Redis cache ready');
    } catch (err) {
      console.warn('⚠️  Redis not available. Continuing without cache.');
    }

    if (process.env.NODE_ENV !== 'test') {
      const server = app.listen(PORT, () => {
        console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
      });

      const shutdown = async () => {
        try { 
          await shutdownMonitoring(); 
          await redis.quit();
          await prisma.$disconnect();
          await typeorm.destroy();
        } catch { /* noop */ }
        server.close(() => process.exit(0));
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

startServer();

export default app;
