// Initialize Sentry first before creating Express app
import { initSentry, sentryErrorHandler, errorTrackingMiddleware } from './middleware/errorTracking';
if (process.env.SENTRY_DSN) {
  initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV || 'development');
}

import express, { Application } from 'express';
import healthRouter, { registerHealthCheck } from './routes/health';
import { generalRateLimit } from './middleware/rateLimiter';
import v1Router from './routes/v1';
import v2Router from './routes/v2';

const app: Application = express();

app.use(express.json());

// Apply general rate limit globally to all /api routes except health
app.use('/api/v1', generalRateLimit.middleware());
app.use('/api/v2', generalRateLimit.middleware());

// Health checks (no rate limiting — monitoring tools need unthrottled access)
app.use('/api', healthRouter);

// Register service health checks
registerHealthCheck('database', async () => {
  // Add your DB check
  return { status: 'up' };
});

registerHealthCheck('stellar', async () => {
  // Add your Stellar check
  return { status: 'up' };
});

registerHealthCheck('ai', async () => {
  // Add your AI service check
  return { status: 'up' };
});

// API routes
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Error handling (must be last)
if (process.env.SENTRY_DSN) {
  app.use(sentryErrorHandler());
}
app.use(errorTrackingMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});

export default app;
