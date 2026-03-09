-- Drop global unique constraint on email if present and replace with partial unique on active users
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_active_unique" ON "User"("email") WHERE "deletedAt" IS NULL;
