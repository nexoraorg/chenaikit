import { Request, Response } from 'express';
import { AnalyticsService, TrendPoint } from '../services/analyticsService';
import { log } from '../utils/logger';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/analytics/dashboard
   */
  getDashboardSummary = async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const summary = await this.analyticsService.getDashboardSummary(startDate, endDate);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      log.error('Dashboard summary fetch failed', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_FETCH_FAILED',
          message: 'Failed to fetch dashboard summary',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/v1/analytics/trends
   */
  getTrends = async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await this.analyticsService.getTrafficTrends(days);
      const forecast = await this.analyticsService.getForecast(7);

      res.json({
        success: true,
        data: {
          history: trends,
          forecast: forecast
        }
      });
    } catch (error) {
      log.error('Trends fetch failed', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRENDS_FETCH_FAILED',
          message: 'Failed to fetch trends',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/v1/analytics/export
   */
  exportData = async (req: Request, res: Response) => {
    try {
      const format = req.query.format as 'csv' | 'pdf' || 'csv';
      const type = req.query.type as 'usage' | 'transactions' || 'usage';
      const days = parseInt(req.query.days as string) || 30;

      let data: TrendPoint[] = [];
      if (type === 'usage') {
        data = await this.analyticsService.getTrafficTrends(days);
      } else {
        // Fallback to usage for now if transactions not specifically implemented for raw export
        data = await this.analyticsService.getTrafficTrends(days);
      }

      const filename = `analytics_export_${type}_${new Date().toISOString().split('T')[0]}`;

      if (format === 'csv') {
        // In a real browser this would download, but here we might send as buffer/stream
        // For the sake of this implementation, we simulate the logic
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        
        if (data.length === 0) {
          return res.send('date,value\n');
        }
        
        const headers = Object.keys(data[0]) as (keyof TrendPoint)[];
        const csv = [
          headers.join(','),
          ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
        ].join('\n');
        
        return res.send(csv);
      } else {
        // PDF Simulation
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
        return res.send(Buffer.from('Simulated PDF Content'));
      }
    } catch (error) {
      log.error('Export failed', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export analytics data',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}
