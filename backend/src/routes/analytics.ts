import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { AnalyticsService } from '../services/analyticsService';
import { PrismaClient } from '@prisma/client';
import { DataSource } from 'typeorm';
import { validate } from '../middleware/validation';
import {
  dashboardQuerySchema,
  trendsQuerySchema,
  exportQuerySchema,
} from '../schemas';

export function createAnalyticsRouter(prisma: PrismaClient, typeorm: DataSource): Router {
  const router = Router();
  const analyticsService = new AnalyticsService(prisma, typeorm);
  const analyticsController = new AnalyticsController(analyticsService);

  /**
   * @route GET /api/v1/analytics/dashboard
   * @desc Get summary statistics for the dashboard
   * @access Private/Admin
   */
  router.get(
    '/dashboard',
    validate({ query: dashboardQuerySchema }),
    analyticsController.getDashboardSummary
  );

  /**
   * @route GET /api/v1/analytics/trends
   * @desc Get traffic trends and forecasting
   * @access Private/Admin
   */
  router.get(
    '/trends',
    validate({ query: trendsQuerySchema }),
    analyticsController.getTrends
  );

  /**
   * @route GET /api/v1/analytics/export
   * @desc Export analytics data as CSV or PDF
   * @access Private/Admin
   */
  router.get(
    '/export',
    validate({ query: exportQuerySchema }),
    analyticsController.exportData
  );

  return router;
}
