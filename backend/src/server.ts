// Initialize Sentry first before creating Express app
import { initSentry, sentryErrorHandler, errorTrackingMiddleware } from './middleware/errorTracking';
if (process.env.SENTRY_DSN) {
  initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV || 'development');
}
import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import healthRouter, { registerHealthCheck } from './routes/health';

const app: Application = express();
app.use(express.json());

// -- API Documentation --------------------------------------------------------
// Serve raw OpenAPI spec as JSON (for export / client generation)
app.get('/api/docs/spec', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(swaggerSpec);
});

// Serve interactive Swagger UI
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'ChenAIKit API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      filter: true,
    },
  })
);

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
  // eslint-disable-next-line no-console
  console.log(`API Docs available at http://localhost:${PORT}/api/docs`);
});

export default app;
