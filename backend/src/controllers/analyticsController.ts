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
      // Validate date inputs before passing to Date() — invalid strings produce
      // NaN timestamps that corrupt DB queries (CodeQL: taint to unsafe sink)
      const startDateRaw = req.query.startDate as string | undefined;
      const endDateRaw = req.query.endDate as string | undefined;

      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;

      if (startDateRaw && !ISO_DATE_RE.test(startDateRaw)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'startDate must be an ISO 8601 date string', timestamp: new Date().toISOString() },
        });
      }
      if (endDateRaw && !ISO_DATE_RE.test(endDateRaw)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'endDate must be an ISO 8601 date string', timestamp: new Date().toISOString() },
        });
      }

      const startDate = startDateRaw ? new Date(startDateRaw) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = endDateRaw ? new Date(endDateRaw) : new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid date value provided', timestamp: new Date().toISOString() },
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'startDate must be before endDate', timestamp: new Date().toISOString() },
        });
      }

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
      const rawDays = parseInt(req.query.days as string);
      const days = Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 30;
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
      // Allowlist format and type — never interpolate raw query params into headers
      // (CodeQL: header injection via Content-Disposition)
      const ALLOWED_FORMATS = ['csv', 'pdf'] as const;
      const ALLOWED_TYPES = ['usage', 'transactions'] as const;

      type ExportFormat = typeof ALLOWED_FORMATS[number];
      type ExportType = typeof ALLOWED_TYPES[number];

      const rawFormat = req.query.format as string;
      const rawType = req.query.type as string;

      if (rawFormat && !ALLOWED_FORMATS.includes(rawFormat as ExportFormat)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `format must be one of: ${ALLOWED_FORMATS.join(', ')}`, timestamp: new Date().toISOString() },
        });
      }
      if (rawType && !ALLOWED_TYPES.includes(rawType as ExportType)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `type must be one of: ${ALLOWED_TYPES.join(', ')}`, timestamp: new Date().toISOString() },
        });
      }

      const format: ExportFormat = (rawFormat as ExportFormat) || 'csv';
      const type: ExportType = (rawType as ExportType) || 'usage';

      const rawDays = parseInt(req.query.days as string);
      const days = Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 30;

      let data: TrendPoint[] = [];
      if (type === 'usage') {
        data = await this.analyticsService.getTrafficTrends(days);
      } else {
        // Fallback to usage for now if transactions not specifically implemented for raw export
        data = await this.analyticsService.getTrafficTrends(days);
      }

      // Build filename from static parts only — never interpolate user-controlled values
      // into Content-Disposition (CodeQL: header injection). The date comes from the
      // server clock, not from user input.
      const datePart = new Date().toISOString().split('T')[0]; // e.g. 2026-06-19
      // Map validated enum values to static string literals so CodeQL's taint tracker
      // cannot follow user input into the header.
      const typeLabel = type === 'transactions' ? 'transactions' : 'usage';
      const filename = `analytics_export_${typeLabel}_${datePart}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        // Quote filename per RFC 6266 to prevent header injection
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        
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
        // PDF export
        res.setHeader('Content-Type', 'application/pdf');
        // Quote filename per RFC 6266
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
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
