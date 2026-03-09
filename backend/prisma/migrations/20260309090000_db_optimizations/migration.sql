-- SQLite migration for performance optimizations and search

-- Add timestamps and soft deletes
ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;

ALTER TABLE "RefreshToken" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- expiresAt already exists

ALTER TABLE "api_keys" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "api_keys" ADD COLUMN "deletedAt" DATETIME;

ALTER TABLE "api_usage" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "api_usage" ADD COLUMN "deletedAt" DATETIME;

-- Indices for common queries
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt");

CREATE INDEX IF NOT EXISTS "RefreshToken_userId_expiresAt_idx" ON "RefreshToken" ("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "api_keys_userId_isActive_idx" ON "api_keys" ("userId", "isActive");
CREATE INDEX IF NOT EXISTS "api_keys_expiresAt_idx" ON "api_keys" ("expiresAt");
CREATE INDEX IF NOT EXISTS "api_keys_lastUsedAt_idx" ON "api_keys" ("lastUsedAt");

CREATE INDEX IF NOT EXISTS "api_usage_apiKeyId_timestamp_idx" ON "api_usage" ("apiKeyId", "timestamp");
CREATE INDEX IF NOT EXISTS "api_usage_endpoint_timestamp_idx" ON "api_usage" ("endpoint", "timestamp");
CREATE INDEX IF NOT EXISTS "api_usage_statusCode_timestamp_idx" ON "api_usage" ("statusCode", "timestamp");
CREATE INDEX IF NOT EXISTS "api_usage_ip_timestamp_idx" ON "api_usage" ("ip", "timestamp");

-- Full-text search for selected fields on api_usage using FTS5
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
