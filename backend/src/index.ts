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
app.use(express.json());

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
  });
});

// Error logging middleware (keep before any custom error handlers)
app.use(errorLoggingMiddleware);

export default app;