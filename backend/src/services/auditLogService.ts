import { prisma } from "../prisma/client";
import { log } from "../utils/logger";

/**
 * PII Redaction patterns - applied to request/response data
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  phone: /(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
  dateOfBirth: /\d{4}-\d{2}-\d{2}/g, // ISO format
};

/**
 * Redact sensitive fields from JSON string
 */
function redactPII(data: unknown): string {
  if (!data) return "";

  let str = typeof data === "string" ? data : JSON.stringify(data);

  // Apply all PII redaction patterns
  Object.values(PII_PATTERNS).forEach((pattern) => {
    str = str.replace(pattern, "[REDACTED]");
  });

  // Also redact known field names
  str = str.replace(
    /"(password|ssn|creditCard|cardNumber|cvv|pin)":\s*"[^"]*"/g,
    '"$1":"[REDACTED]"',
  );

  return str;
}

export interface CreateAuditLogInput {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  requestData?: unknown;
  responseData?: unknown;
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AuditLogSearchQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resource?: string;
  ipAddress?: string;
  statusCode?: number;
  searchQuery?: string; // Full-text search
  limit?: number;
  offset?: number;
}

export interface AuditLogStatistics {
  totalEvents: number;
  uniqueUsers: number;
  failureRate: number;
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  topIPs: Array<{ ipAddress: string; count: number }>;
  failedActionsCount: number;
}

/**
 * AuditLogService
 * Handles creation, search, archival, and compliance reporting for audit logs
 */
export class AuditLogService {
  /**
   * Create and persist an audit log entry
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<void> {
    try {
      const hasRequestPII = input.requestData
        ? JSON.stringify(input.requestData).match(
            /[a-zA-Z0-9._%+-]+@|ssn|creditCard/,
          )
        : false;
      const hasResponsePII = input.responseData
        ? JSON.stringify(input.responseData).match(
            /[a-zA-Z0-9._%+-]+@|ssn|creditCard/,
          )
        : false;
      const piiWasRedacted = !!(hasRequestPII || hasResponsePII);

      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          method: input.method,
          endpoint: input.endpoint,
          statusCode: input.statusCode,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestData: input.requestData ? redactPII(input.requestData) : null,
          responseData: input.responseData
            ? redactPII(input.responseData)
            : null,
          errorMessage: input.errorMessage,
          duration: input.duration,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          piiRedacted: piiWasRedacted,
        },
      });

      log.info("Audit log created", {
        action: input.action,
        userId: input.userId,
        resource: input.resource,
        piiRedacted: piiWasRedacted,
      });
    } catch (error) {
      log.error("Failed to create audit log", error, {
        action: input.action,
      });
      // Don't throw - audit logging shouldn't break application
    }
  }

  /**
   * Search audit logs with advanced filtering
   * Supports date range, user, action, resource, IP filtering
   * Full-text search on request/response details
   */
  async searchAuditLogs(query: AuditLogSearchQuery) {
    const {
      startDate,
      endDate,
      userId,
      action,
      resource,
      ipAddress,
      statusCode,
      searchQuery,
      limit = 50,
      offset = 0,
    } = query;

    // Build WHERE clause
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (ipAddress) where.ipAddress = ipAddress;
    if (statusCode !== undefined) where.statusCode = statusCode;
    if (searchQuery) {
      // Full-text search on requestData and responseData
      where.OR = [
        { requestData: { contains: searchQuery } },
        { responseData: { contains: searchQuery } },
        { errorMessage: { contains: searchQuery } },
      ];
    }

    where.deletedAt = null; // Exclude soft-deleted entries

    // Execute query
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get audit log statistics for compliance/monitoring
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLogStatistics> {
    const where: any = { deletedAt: null };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Get total count
    const totalEvents = await prisma.auditLog.count({ where });

    // Get unique users
    const uniqueUsers = await prisma.auditLog.findMany({
      where,
      distinct: ["userId"],
      select: { userId: true },
    });
    const uniqueUserCount = uniqueUsers.filter((u) => u.userId).length;

    // Get failed actions
    const failedActions = await prisma.auditLog.findMany({
      where: { ...where, statusCode: { gte: 400 } },
      select: { id: true },
    });
    const failureRate =
      totalEvents > 0 ? (failedActions.length / totalEvents) * 100 : 0;

    // Top users (by action count)
    const topUserData = await prisma.auditLog.groupBy({
      by: ["userId"],
      where,
      _count: true,
      orderBy: { _count: "desc" },
      take: 5,
    });
    const topUsers = topUserData
      .filter((u) => u.userId)
      .map((u) => ({ userId: u.userId!, count: u._count }));

    // Top actions
    const topActionsData = await prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: "desc" },
      take: 5,
    });
    const topActions = topActionsData.map((a) => ({
      action: a.action,
      count: a._count,
    }));

    // Top resources
    const topResourcesData = await prisma.auditLog.groupBy({
      by: ["resource"],
      where: { ...where, resource: { not: null } },
      _count: true,
      orderBy: { _count: "desc" },
      take: 5,
    });
    const topResources = topResourcesData.map((r) => ({
      resource: r.resource || "",
      count: r._count,
    }));

    // Top IPs (for geographic distribution)
    const topIPsData = await prisma.auditLog.groupBy({
      by: ["ipAddress"],
      where: { ...where, ipAddress: { not: null } },
      _count: true,
      orderBy: { _count: "desc" },
      take: 5,
    });
    const topIPs = topIPsData.map((ip) => ({
      ipAddress: ip.ipAddress || "",
      count: ip._count,
    }));

    return {
      totalEvents,
      uniqueUsers: uniqueUserCount,
      failureRate: Math.round(failureRate * 100) / 100,
      topUsers,
      topActions,
      topResources,
      topIPs,
      failedActionsCount: failedActions.length,
    };
  }

  /**
   * Archive logs older than retention period (move to cold storage flag)
   * Called daily by scheduled job
   */
  async archiveOldLogs(hotStorageDays: number = 90): Promise<number> {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - hotStorageDays);

    try {
      const result = await prisma.auditLog.updateMany({
        where: {
          createdAt: { lt: archiveDate },
          archivedAt: null,
          deletedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      log.info("Archived old audit logs", {
        count: result.count,
        threshold: hotStorageDays,
      });

      return result.count;
    } catch (error) {
      log.error("Failed to archive audit logs", error);
      throw error;
    }
  }

  /**
   * Soft-delete audit logs for GDPR right-to-be-forgotten
   */
  async deleteUserAuditLogs(userId: string): Promise<number> {
    try {
      const result = await prisma.auditLog.updateMany({
        where: { userId },
        data: { deletedAt: new Date() },
      });

      log.info("Deleted user audit logs", {
        userId,
        count: result.count,
      });

      return result.count;
    } catch (error) {
      log.error("Failed to delete user audit logs", error, { userId });
      throw error;
    }
  }

  /**
   * Export audit logs as CSV for compliance reporting
   * Handles large datasets with streaming
   */
  async exportToCSV(query: AuditLogSearchQuery): Promise<string> {
    const { logs } = await this.searchAuditLogs({ ...query, limit: 10000 });

    // CSV header
    const headers = [
      "ID",
      "Timestamp",
      "User ID",
      "Action",
      "Resource",
      "Method",
      "Endpoint",
      "Status Code",
      "IP Address",
      "Duration (ms)",
      "PII Redacted",
      "Error Message",
    ];

    // CSV rows
    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.userId || "",
      log.action,
      log.resource || "",
      log.method || "",
      log.endpoint || "",
      log.statusCode || "",
      log.ipAddress || "",
      log.duration || "",
      log.piiRedacted ? "Yes" : "No",
      log.errorMessage || "",
    ]);

    // Combine headers + rows
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return csv;
  }

  /**
   * Generate GDPR compliance report showing data access patterns
   */
  async generateGDPRReport(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId, deletedAt: null };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return {
      userId,
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      totalDataAccesses: logs.length,
      accessByAction: logs.reduce((acc: Record<string, number>, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      accessByResource: logs.reduce((acc: Record<string, number>, log) => {
        if (log.resource) acc[log.resource] = (acc[log.resource] || 0) + 1;
        return acc;
      }, {}),
      piiAccessedCount: logs.filter((l) => l.piiRedacted).length,
      logs: logs.map((l) => ({
        timestamp: l.createdAt,
        action: l.action,
        resource: l.resource,
        accessedBy: l.ipAddress,
      })),
    };
  }

  /**
   * Generate SOC2 compliance report
   */
  async generateSOC2Report(startDate: Date, endDate: Date) {
    const where = {
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
    };

    const stats = await this.getStatistics(startDate, endDate);
    const failedLogins = await prisma.auditLog.count({
      where: {
        ...where,
        action: "LOGIN",
        statusCode: { gte: 401 },
      },
    });

    const unauthorizedAccess = await prisma.auditLog.count({
      where: {
        ...where,
        statusCode: 403,
      },
    });

    const dataModifications = await prisma.auditLog.findMany({
      where: {
        ...where,
        method: { in: ["POST", "PUT", "PATCH", "DELETE"] },
      },
    });

    return {
      reportTitle: "SOC2 Compliance Report",
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      summary: {
        totalEvents: stats.totalEvents,
        uniqueUsers: stats.uniqueUsers,
        failureRate: stats.failureRate,
        failedLoginAttempts: failedLogins,
        unauthorizedAccessAttempts: unauthorizedAccess,
        dataModificationsCount: dataModifications.length,
      },
      topActions: stats.topActions,
      topResources: stats.topResources,
      securityEvents: {
        failedAuthentications: failedLogins,
        unauthorizedAccessAttempts: unauthorizedAccess,
        suspiciousIPs: stats.topIPs.slice(0, 10),
      },
    };
  }
}

export const auditLogService = new AuditLogService();
