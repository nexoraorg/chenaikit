// ChenAIKit Backend Server
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestLoggingMiddleware } from './middleware/logging';
import healthRouter from './routes/health';
import { metricsService, metricsMiddleware } from './services/metricsService';
import { validateEnvironment, initializeMonitoring, shutdownMonitoring } from './config/monitoring';
import authRoutes from './routes/auth';
import { ensureRedisConnection } from './config/redis';
import accountRoutes from './routes/accounts';

// Load environment variables
dotenv.config();

// Validate environment configuration
validateEnvironment();

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);

// Placeholder endpoints for future implementation
app.get('/api/accounts/:id/credit-score', (req: Request, res: Response) => {
  res.json({
    message: 'Credit scoring endpoint - implementation pending'
  });
});

app.post('/api/fraud/detect', (req: Request, res: Response) => {
  res.json({
    message: 'Fraud detection endpoint - implementation pending'
  });
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
initializeMonitoring().finally(() => {
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
    } catch { 
      /* noop */ 
    }
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});

export default app;
