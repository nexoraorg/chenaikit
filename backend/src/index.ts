// ChenAIKit Backend Server
// TODO: Implement backend API endpoints - See backend issues in .github/ISSUE_TEMPLATE/

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestLoggingMiddleware, errorLoggingMiddleware, loggingMiddlewares } from './middleware/logging';
import healthRouter from './routes/health';
import { metricsService, metricsMiddleware } from './services/metricsService';
import { validateEnvironment, initializeMonitoring, shutdownMonitoring } from './config/monitoring';
import accountRoutes from './routes/accounts';


// Load environment variables
dotenv.config();

// Validate environment configuration
validateEnvironment();

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Initialize monitoring
initializeMonitoring().finally(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics:       http://localhost:${PORT}/metrics`);
    console.log(`📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);
  });

  const shutdown = async () => {
    try { await shutdownMonitoring(); } catch { /* noop */ }
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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

// Placeholder endpoints - implementation pending
app.get('/api/accounts/:id', (req: Request, res: Response) => {
  res.json({
    message: 'Account endpoint - implementation pending - see backend-01-api-endpoints.md'
  });
});

app.post('/api/accounts', (req: Request, res: Response) => {
  res.json({
    message: 'Account creation endpoint - implementation pending - see backend-01-api-endpoints.md'
  });
});

app.get('/api/accounts/:id/credit-score', (req: Request, res: Response) => {
  res.json({
    message: 'Credit scoring endpoint - implementation pending - see backend-01-api-endpoints.md'
  });
});

app.post('/api/fraud/detect', (req: Request, res: Response) => {
  res.json({
    message: 'Fraud detection endpoint - implementation pending - see backend-01-api-endpoints.md'
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'chenaikit-backend',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/accounts', accountRoutes);

// Placeholder endpoints for future implementation
app.get('/api/accounts/:id/credit-score', (req, res) => {
  res.json({
    message: 'Credit scoring endpoint - implementation pending'
  });
});

app.post('/api/fraud/detect', (req, res) => {
  res.json({
    message: 'Fraud detection endpoint - implementation pending'
  });
});

// 404 handler
app.use('*', (req, res) => {
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
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

// Error logging middleware (keep before any custom error handlers)
app.use(errorLoggingMiddleware);

export default app;