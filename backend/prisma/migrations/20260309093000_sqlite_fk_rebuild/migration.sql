PRAGMA foreign_keys=OFF;

-- Rebuild RefreshToken with ON DELETE CASCADE
CREATE TABLE "RefreshToken_new" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "RefreshToken_new" ("id","tokenHash","userId","createdAt","updatedAt","expiresAt")
SELECT "id","tokenHash","userId","createdAt","updatedAt","expiresAt" FROM "RefreshToken";

DROP TABLE "RefreshToken";
ALTER TABLE "RefreshToken_new" RENAME TO "RefreshToken";
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken" ("userId","expiresAt");

-- Rebuild api_keys with ON DELETE SET NULL
CREATE TABLE "api_keys_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keyHash" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'FREE',
  "userId" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "allowedIps" TEXT NOT NULL DEFAULT '',
  "allowedPaths" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME,
  "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usageQuota" INTEGER,
  "currentUsage" INTEGER NOT NULL DEFAULT 0,
  "usageResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" DATETIME,
  CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "api_keys_new" (
  "id","keyHash","name","tier","userId","isActive","allowedIps","allowedPaths",
  "createdAt","updatedAt","expiresAt","lastUsedAt","usageQuota","currentUsage","usageResetAt","deletedAt"
) SELECT
  "id","keyHash","name","tier","userId","isActive","allowedIps","allowedPaths",
  "createdAt","updatedAt","expiresAt","lastUsedAt","usageQuota","currentUsage","usageResetAt","deletedAt"
FROM "api_keys";

DROP TABLE "api_keys";
ALTER TABLE "api_keys_new" RENAME TO "api_keys";
CREATE INDEX "api_keys_userId_isActive_idx" ON "api_keys" ("userId","isActive");
CREATE INDEX "api_keys_expiresAt_idx" ON "api_keys" ("expiresAt");
CREATE INDEX "api_keys_lastUsedAt_idx" ON "api_keys" ("lastUsedAt");

-- Drop FTS triggers/table to avoid stale references
DROP TRIGGER IF EXISTS api_usage_ai;
DROP TRIGGER IF EXISTS api_usage_ad;
DROP TRIGGER IF EXISTS api_usage_au;
DROP TABLE IF EXISTS api_usage_fts;

-- Rebuild api_usage with ON DELETE CASCADE to api_keys
CREATE TABLE "api_usage_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "apiKeyId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "responseTime" INTEGER NOT NULL,
  "requestSize" INTEGER NOT NULL,
  "responseSize" INTEGER NOT NULL,
  "ip" TEXT NOT NULL,
  "userAgent" TEXT,
  "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" DATETIME,
  CONSTRAINT "api_usage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "api_usage_new" (
  "id","apiKeyId","endpoint","method","statusCode","responseTime",
  "requestSize","responseSize","ip","userAgent","timestamp","updatedAt","deletedAt"
) SELECT
  "id","apiKeyId","endpoint","method","statusCode","responseTime",
  "requestSize","responseSize","ip","userAgent","timestamp","updatedAt","deletedAt"
FROM "api_usage";

DROP TABLE "api_usage";
ALTER TABLE "api_usage_new" RENAME TO "api_usage";
CREATE INDEX "api_usage_apiKeyId_timestamp_idx" ON "api_usage" ("apiKeyId","timestamp");
CREATE INDEX "api_usage_endpoint_timestamp_idx" ON "api_usage" ("endpoint","timestamp");
CREATE INDEX "api_usage_statusCode_timestamp_idx" ON "api_usage" ("statusCode","timestamp");
CREATE INDEX "api_usage_ip_timestamp_idx" ON "api_usage" ("ip","timestamp");

-- Recreate FTS and triggers, and repopulate FTS from current data
CREATE VIRTUAL TABLE IF NOT EXISTS api_usage_fts USING fts5(
  endpoint,
  userAgent,
  ip,
  content='api_usage',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS api_usage_ai AFTER INSERT ON api_usage BEGIN
  INSERT INTO api_usage_fts(rowid, endpoint, userAgent, ip)
  VALUES (new.rowid, new.endpoint, new.userAgent, new.ip);
END;

CREATE TRIGGER IF NOT EXISTS api_usage_ad AFTER DELETE ON api_usage BEGIN
  INSERT INTO api_usage_fts(api_usage_fts, rowid, endpoint, userAgent, ip)
  VALUES('delete', old.rowid, old.endpoint, old.userAgent, old.ip);
END;

CREATE TRIGGER IF NOT EXISTS api_usage_au AFTER UPDATE ON api_usage BEGIN
  INSERT INTO api_usage_fts(api_usage_fts, rowid, endpoint, userAgent, ip)
  VALUES('delete', old.rowid, old.endpoint, old.userAgent, old.ip);
  INSERT INTO api_usage_fts(rowid, endpoint, userAgent, ip)
  VALUES (new.rowid, new.endpoint, new.userAgent, new.ip);
END;

INSERT INTO api_usage_fts(rowid, endpoint, userAgent, ip)
SELECT rowid, endpoint, userAgent, ip FROM api_usage;

PRAGMA foreign_keys=ON;
