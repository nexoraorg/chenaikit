// ChenAIKit Backend Server
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { requestLoggingMiddleware } from './middleware/logging';
import healthRouter from './routes/health';
import { metricsService, metricsMiddleware } from './services/metricsService';
import { validateEnvironment, initializeMonitoring, shutdownMonitoring } from './config/monitoring';
import authRoutes from './routes/auth';
import { ensureRedisConnection } from './config/redis';
import accountRoutes from './routes/accounts';
import { PrismaClient } from './generated/prisma';
import { ApiKeyService } from './services/apiKeyService';
import { UsageTrackingService } from './services/usageTrackingService';
import { ApiGateway } from './middleware/apiGateway';
import { createTieredRateLimiter } from './middleware/advancedRateLimiter';
import Redis from 'ioredis';
import { applySecurityMiddleware } from './middleware/security';
import { loadVaultSecrets } from './config/secrets';

const start = async (): Promise<express.Application> => {
  // Load environment variables
  dotenv.config();

  // Optional: load secrets from Vault before validating environment
  await loadVaultSecrets();

  // Validate environment configuration
  validateEnvironment();

  // Initialize services
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const apiKeyService = new ApiKeyService(prisma);
  const usageTrackingService = new UsageTrackingService(prisma);
  const rateLimiter = createTieredRateLimiter(redis);
  const apiGateway = new ApiGateway(apiKeyService, usageTrackingService, rateLimiter);

  const app: express.Application = express();
  const PORT = process.env.PORT || 5000;

  // Middleware
  applySecurityMiddleware(app);
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

// Gateway-protected endpoints
app.use('/api/v1/credit-score', ...gatewayMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      score: Math.floor(Math.random() * 850) + 150,
      factors: ['payment_history', 'credit_utilization', 'account_age'],
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api/v1/fraud/detect', ...gatewayMiddleware, (req: Request, res: Response) => {
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
app.post('/api/v1/keys', ...gatewayMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, tier = 'FREE', allowedIps, allowedPaths, usageQuota } = req.body;
    const user = (req as any).user; // Assuming auth middleware adds user
    
    const { apiKey, plainKey } = await apiKeyService.createApiKey({
      name,
      tier,
      userId: user?.id,
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
  } catch (error) {
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

app.get('/api/v1/keys', ...gatewayMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const apiKeys = await apiKeyService.getApiKeysByUserId(user?.id);
    
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
  } catch (error) {
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

app.get('/api/v1/analytics', ...gatewayMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    
    const analytics = await usageTrackingService.getAnalytics(startDate, endDate);
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
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
  } catch (error) {
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
  } catch (e: any) {
    res.status(500).send(e?.message || 'metrics error');
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

  // Initialize monitoring and start server
  await initializeMonitoring();

  const server = app.listen(PORT, async () => {
    console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
    console.log(`📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);
    
    try {
      await ensureRedisConnection();
      console.log('🧠 Redis cache ready');
    } catch (err) {
      console.warn('⚠️  Redis not available. Continuing without cache.');
    }
  });

  const shutdown = async () => {
    try { 
      await shutdownMonitoring(); 
      await redis.quit();
      await prisma.$disconnect();
    } catch { 
      /* noop */ 
    }
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return app;
};

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

export default start;
