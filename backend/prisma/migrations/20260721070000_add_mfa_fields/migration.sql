-- AlterTable: Add MFA fields to User model
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "backupCodes" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaRecoveryEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaLastVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "mfaFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mfaLockedUntil" DATETIME;
