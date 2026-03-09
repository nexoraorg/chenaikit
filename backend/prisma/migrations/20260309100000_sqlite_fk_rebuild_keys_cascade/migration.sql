PRAGMA foreign_keys=OFF;

-- Rebuild api_keys to enforce ON DELETE CASCADE to User
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
  CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

CREATE INDEX IF NOT EXISTS "api_keys_userId_isActive_idx" ON "api_keys" ("userId","isActive");
CREATE INDEX IF NOT EXISTS "api_keys_expiresAt_idx" ON "api_keys" ("expiresAt");
CREATE INDEX IF NOT EXISTS "api_keys_lastUsedAt_idx" ON "api_keys" ("lastUsedAt");

PRAGMA foreign_keys=ON;
