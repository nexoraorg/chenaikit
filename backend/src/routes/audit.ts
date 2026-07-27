import { Router, Request, Response } from "express";
import {
  auditLogService,
  AuditLogSearchQuery,
} from "../services/auditLogService";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { z } from "zod";
import { log } from "../utils/logger";

const router = Router();

// Schemas
const searchSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  ipAddress: z.string().optional(),
  statusCode: z.coerce.number().optional(),
  searchQuery: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const exportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

const gdprReportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/audit/logs
 * Search audit logs with advanced filtering
 * Only admin can view all logs, users can only see their own
 */
router.get(
  "/logs",
  authenticate(),
  validate({ query: searchSchema }),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const query = req.query as any;

      // If not admin, restrict to user's own logs
      if (user.role !== "admin") {
        query.userId = user.id;
      }

      const searchQuery: AuditLogSearchQuery = {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        userId: query.userId,
        action: query.action,
        resource: query.resource,
        ipAddress: query.ipAddress,
        statusCode: query.statusCode,
        searchQuery: query.searchQuery,
        limit: query.limit,
        offset: query.offset,
      };

      const result = await auditLogService.searchAuditLogs(searchQuery);

      res.json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      log.error("Audit log search failed", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "AUDIT_SEARCH_FAILED",
          message: "Failed to search audit logs",
        },
      });
    }
  },
);

/**
 * GET /api/audit/statistics
 * Get audit log statistics for monitoring/compliance
 * Only admin access
 */
router.get(
  "/statistics",
  authenticate(),
  authorize("admin"),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as any;

      const stats = await auditLogService.getStatistics(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      log.error("Failed to get audit statistics", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "STATS_FAILED",
          message: "Failed to retrieve statistics",
        },
      });
    }
  },
);

/**
 * GET /api/audit/export
 * Export audit logs as CSV/JSON for compliance reporting
 * Only admin can export all logs, users can only export their own
 */
router.get(
  "/export",
  authenticate(),
  validate({ query: exportSchema }),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { startDate, endDate, userId, action, format } = req.query as any;

      // If not admin, restrict to user's own logs
      const finalUserId = user.role !== "admin" ? user.id : userId;

      const query: AuditLogSearchQuery = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        userId: finalUserId,
        action,
        limit: 10000,
      };

      if (format === "csv") {
        const csv = await auditLogService.exportToCSV(query);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=audit-logs.csv",
        );
        res.send(csv);
      } else {
        const { logs } = await auditLogService.searchAuditLogs(query);
        res.json({
          success: true,
          data: logs,
        });
      }
    } catch (error) {
      log.error("Audit log export failed", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "EXPORT_FAILED",
          message: "Failed to export audit logs",
        },
      });
    }
  },
);

/**
 * GET /api/audit/gdpr-report/:userId
 * Generate GDPR compliance report for a user
 * Users can only view their own, admins can view all
 */
router.get(
  "/gdpr-report/:userId",
  authenticate(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { userId } = req.params;
      const { startDate, endDate } = req.query as any;

      // Authorization check
      if (user.role !== "admin" && user.id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "You can only view your own GDPR report",
          },
        });
        return;
      }

      const report = await auditLogService.generateGDPRReport(
        userId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      log.error("GDPR report generation failed", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "REPORT_FAILED",
          message: "Failed to generate GDPR report",
        },
      });
    }
  },
);

/**
 * GET /api/audit/soc2-report
 * Generate SOC2 compliance report for date range
 * Only admin access
 */
router.get(
  "/soc2-report",
  authenticate(),
  authorize("admin"),
  validate({ query: gdprReportSchema }),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as any;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "startDate and endDate are required",
          },
        });
        return;
      }

      const report = await auditLogService.generateSOC2Report(
        new Date(startDate),
        new Date(endDate),
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      log.error("SOC2 report generation failed", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "REPORT_FAILED",
          message: "Failed to generate SOC2 report",
        },
      });
    }
  },
);

/**
 * DELETE /api/audit/logs/:id
 * Soft-delete an audit log entry
 * Only admin or the owner can delete
 */
router.delete(
  "/logs/:id",
  authenticate(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      // TODO: Implement soft-delete for specific logs
      // For now, only allow full user deletion via GDPR request

      res.status(403).json({
        success: false,
        error: {
          code: "NOT_ALLOWED",
          message:
            "Individual log deletion not supported. Use GDPR deletion request.",
        },
      });
    } catch (error) {
      log.error("Audit log deletion failed", error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: "Failed to delete audit log",
        },
      });
    }
  },
);

export default router;
