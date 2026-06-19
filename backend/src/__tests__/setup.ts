/**
 * Integration test global setup
 *
 * Wires up an in-process SQLite database via Prisma, seeds baseline data,
 * and exposes helpers for creating the Express app under test.
 *
 * Registered as setupFilesAfterEnv so the beforeAll/afterAll hooks run once
 * per test suite file.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Environment bootstrap (also done in jest.integration.setup.js, repeated here
// as a safety net in case setup.ts is loaded standalone)
// ──────────────────────────────────────────────────────────────────────────────

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  `file:${path.resolve(__dirname, '../../prisma/test.db')}`;
process.env.ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'integration_test_access_secret';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'integration_test_refresh_secret';
process.env.ACCESS_TOKEN_EXPIRATION = '15m';
process.env.REFRESH_TOKEN_EXPIRATION = '7d';
process.env.LOG_LEVEL = 'error';

// ──────────────────────────────────────────────────────────────────────────────
// Prisma client singleton (test scope)
// ──────────────────────────────────────────────────────────────────────────────

let prismaInstance: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
      log: [],
    });
  }
  return prismaInstance;
}

// ──────────────────────────────────────────────────────────────────────────────
// DB lifecycle helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Push the Prisma schema to the test SQLite database without running
 * migrations (faster for test cycles).
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    execSync('npx prisma db push --force-reset --accept-data-loss', {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    const msg = (err as any).stderr?.toString() ?? '';
    if (!msg.includes('warn') && !msg.includes('info')) {
      throw err;
    }
  }
}

/**
 * Remove all rows from every table in dependency-safe order.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  // Use raw SQL so we never fail on a missing table (schema may not have been
  // pushed yet when this is called from a fresh test worker).
  await prisma.$executeRawUnsafe('DELETE FROM api_usage WHERE 1=1').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM api_keys WHERE 1=1').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "RefreshToken" WHERE 1=1').catch(() => {});
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE 1=1').catch(() => {});
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

/**
 * Disconnect Prisma and close the Redis client that ioredis creates lazily
 * when the app module is imported.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }

  // Close the shared Redis client created by src/config/redis.ts (if any)
  try {
    const { createRedisClient } = await import('../config/redis');
    const redis = createRedisClient();
    if ((redis as any).status !== 'end') {
      await redis.quit();
    }
  } catch {
    // Redis not available in this environment — that's fine
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Global Jest hooks
// ──────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});
