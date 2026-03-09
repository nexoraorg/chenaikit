import express from 'express';
import {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  errorTrackingMiddleware
} from './middleware/errorTracking';
import healthRouter, { registerHealthCheck } from './routes/health';

const app = express();

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV || 'development');
  app.use(sentryRequestHandler());
  app.use(sentryTracingHandler());
}

app.use(express.json());

// Health checks
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

// Your API routes here
// app.use('/api/credit', creditRouter);
// app.use('/api/fraud', fraudRouter);

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
