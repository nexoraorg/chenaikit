import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { AnalyticsService } from '../services/analyticsService';
import { PrismaClient } from '@prisma/client';
import { DataSource } from 'typeorm';
import { generalRateLimit } from '../middleware/rateLimiter';
import { RateLimiter } from '../middleware/rateLimiter';

// Tighter limit for the export endpoint — it's expensive to generate
const exportRateLimit = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many export requests. Please wait before exporting again.',
});

export function createAnalyticsRouter(prisma: PrismaClient, typeorm: DataSource): Router {
  const router = Router();
  const analyticsService = new AnalyticsService(prisma, typeorm);
  const analyticsController = new AnalyticsController(analyticsService);

  // Apply general rate limiting to all analytics routes
  router.use(generalRateLimit.middleware());

  /**
   * @route GET /api/v1/analytics/dashboard
   * @desc Get summary statistics for the dashboard
   * @access Private/Admin
   */
  router.get('/dashboard', analyticsController.getDashboardSummary);

  /**
   * @route GET /api/v1/analytics/trends
   * @desc Get traffic trends and forecasting
   * @access Private/Admin
   */
  router.get('/trends', analyticsController.getTrends);

  /**
   * @route GET /api/v1/analytics/export
   * @desc Export analytics data as CSV or PDF
   * @access Private/Admin
   */
  router.get('/export', exportRateLimit.middleware(), analyticsController.exportData);

  return router;
}
