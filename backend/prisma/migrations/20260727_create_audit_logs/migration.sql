-- CreateTable AuditLog
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "resourceId" TEXT,
  "method" TEXT,
  "endpoint" TEXT,
  "statusCode" INTEGER,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestData" TEXT,
  "responseData" TEXT,
  "errorMessage" TEXT,
  "duration" INTEGER,
  "metadata" TEXT,
  "piiRedacted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" DATETIME,
  "deletedAt" DATETIME,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- CreateIndex: timestamp (for hot storage queries, ordered for range scans)
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex: userId for filtering by user
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex: action for filtering by action type
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex: ipAddress for geographic distribution analysis
CREATE INDEX "audit_logs_ipAddress_idx" ON "audit_logs"("ipAddress");

-- CreateIndex: statusCode for failed actions search
CREATE INDEX "audit_logs_statusCode_idx" ON "audit_logs"("statusCode");

-- CreateIndex: archivedAt for retention queries (soft delete)
CREATE INDEX "audit_logs_archivedAt_idx" ON "audit_logs"("archivedAt");

-- CreateIndex: composite index for common queries (userId + createdAt)
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex: composite for action + status (failed actions by type)
CREATE INDEX "audit_logs_action_statusCode_idx" ON "audit_logs"("action", "statusCode");
