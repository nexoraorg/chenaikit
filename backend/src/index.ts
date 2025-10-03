// ChenAIKit Backend Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ensureRedisConnection } from './config/redis';
import { cacheMiddleware } from './middleware/cache';
import { CacheKeys } from './utils/cacheKeys';
import accountRoutes from './routes/accounts';

// Load environment variables
dotenv.config();

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'chenaikit-backend',
    version: '1.0.0'
  });
});

// Placeholder endpoints - implementation pending
app.get(
  '/api/accounts/:id',
  cacheMiddleware({ keyBuilder: (req) => CacheKeys.accountById(req.params.id), ttlSeconds: 60 }),
  (req, res) => {
    res.json({ 
      message: 'Account endpoint - implementation pending - see backend-01-api-endpoints.md' 
    });
  }
);
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

app.get(
  '/api/accounts/:id/credit-score',
  cacheMiddleware({ keyBuilder: (req) => CacheKeys.creditScoreByAccount(req.params.id), ttlSeconds: 300 }),
  (req, res) => {
    res.json({ 
      message: 'Credit scoring endpoint - implementation pending - see backend-01-api-endpoints.md' 
    });
  }
);
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
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 ChenAIKit Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📋 See .github/ISSUE_TEMPLATE/ for backend development tasks`);
  try {
    await ensureRedisConnection();
    console.log('🧠 Redis cache ready');
  } catch (err) {
    console.warn('⚠️  Redis not available. Continuing without cache.');
  }
});

export default app;