import { log } from "../utils/logger";
import { auditLogService } from "../services/auditLogService";

/**
 * Scheduled job to archive old audit logs
 * Runs daily (or as configured)
 * Moves logs older than HOT_STORAGE_DAYS to cold storage (flagged with archivedAt)
 */
export async function archiveAuditLogsJob(): Promise<void> {
  try {
    const hotStorageDays = parseInt(
      process.env.AUDIT_HOT_STORAGE_DAYS || "90",
      10,
    );

    log.info("Starting audit log archival job", {
      hotStorageDays,
    });

    const archivedCount = await auditLogService.archiveOldLogs(hotStorageDays);

    log.info("Audit log archival job completed", {
      archivedCount,
      hotStorageDays,
    });
  } catch (error) {
    log.error("Audit log archival job failed", error as Error);
    // Don't throw - let scheduler handle retry
  }
}

/**
 * Schedule the archival job
 * Call this during app initialization
 */
export function scheduleAuditLogArchivalJob(): void {
  const intervalMs = parseInt(
    process.env.AUDIT_ARCHIVAL_INTERVAL_MS || "86400000",
    10,
  ); // Daily

  log.info("Scheduling audit log archival job", {
    intervalMs,
    intervalHours: Math.round(intervalMs / 3600000),
  });

  // Run immediately on startup
  archiveAuditLogsJob().catch((err) => {
    log.error("Initial audit log archival failed", err as Error);
  });

  // Then run on schedule
  setInterval(() => {
    archiveAuditLogsJob().catch((err) => {
      log.error("Scheduled audit log archival failed", err as Error);
    });
  }, intervalMs);
}
