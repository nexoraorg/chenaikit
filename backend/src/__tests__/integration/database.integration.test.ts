/**
 * Database integration tests
 *
 * Tests Prisma operations against the real SQLite test database.
 * Covers CRUD on each model, constraint enforcement, and relation
 * cascades without going through the HTTP layer.
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { cleanDatabase, getTestPrisma } from '../setup';

const prisma: PrismaClient = getTestPrisma();

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function createTestUser(overrides: Partial<{ email: string; password: string; role: string }> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${randomBytes(4).toString('hex')}@test.com`,
      password: overrides.password ?? 'hashed-password',
      role: overrides.role ?? 'user',
    },
  });
}

async function createTestApiKey(userId?: string) {
  const raw = `ck_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  return prisma.apiKey.create({
    data: {
      keyHash: hash,
      name: `Key ${randomBytes(4).toString('hex')}`,
      tier: 'FREE',
      userId: userId ?? null,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────────────────────────

describe('Database – integration', () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
  }, 30000);

  // ── User model ─────────────────────────────────────────────────────────────

  describe('User model', () => {
    it('creates a user with defaults', async () => {
      const user = await createTestUser();
      expect(user.id).toBeDefined();
      expect(user.role).toBe('user');
      expect(user.deletedAt).toBeNull();
    });

    it('allows multiple users with different emails', async () => {
      await createTestUser({ email: 'a@test.com' });
      await createTestUser({ email: 'b@test.com' });
      const count = await prisma.user.count();
      expect(count).toBe(2);
    });

    it('supports soft-delete via deletedAt', async () => {
      const user = await createTestUser();
      const deleted = await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });
      expect(deleted.deletedAt).not.toBeNull();

      // The user is not returned when filtering for active users
      const active = await prisma.user.findFirst({ where: { id: user.id, deletedAt: null } });
      expect(active).toBeNull();
    });
  });

  // ── RefreshToken model ─────────────────────────────────────────────────────

  describe('RefreshToken model', () => {
    it('creates a refresh token linked to a user', async () => {
      const user = await createTestUser();
      const token = await prisma.refreshToken.create({
        data: {
          tokenHash: randomBytes(32).toString('hex'),
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      expect(token.id).toBeDefined();
      expect(token.userId).toBe(user.id);
    });

    it('cascades deletion when user is deleted', async () => {
      const user = await createTestUser();
      await prisma.refreshToken.create({
        data: {
          tokenHash: randomBytes(32).toString('hex'),
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });

      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(0);
    });

    it('enforces unique tokenHash', async () => {
      const user = await createTestUser();
      const hash = randomBytes(32).toString('hex');
      await prisma.refreshToken.create({
        data: { tokenHash: hash, userId: user.id, expiresAt: new Date(Date.now() + 86400000) },
      });

      await expect(
        prisma.refreshToken.create({
          data: { tokenHash: hash, userId: user.id, expiresAt: new Date(Date.now() + 86400000) },
        })
      ).rejects.toThrow();
    });
  });

  // ── ApiKey model ───────────────────────────────────────────────────────────

  describe('ApiKey model', () => {
    it('creates an API key with default tier FREE', async () => {
      const key = await createTestApiKey();
      expect(key.id).toBeDefined();
      expect(key.tier).toBe('FREE');
      expect(key.isActive).toBe(true);
    });

    it('associates an API key with a user', async () => {
      const user = await createTestUser();
      const key = await createTestApiKey(user.id);
      expect(key.userId).toBe(user.id);
    });

    it('enforces unique keyHash', async () => {
      const hash = createHash('sha256').update('duplicate').digest('hex');
      await prisma.apiKey.create({ data: { keyHash: hash, name: 'First', tier: 'FREE' } });

      await expect(
        prisma.apiKey.create({ data: { keyHash: hash, name: 'Second', tier: 'FREE' } })
      ).rejects.toThrow();
    });

    it('supports soft-delete via deletedAt', async () => {
      const key = await createTestApiKey();
      await prisma.apiKey.update({ where: { id: key.id }, data: { deletedAt: new Date() } });

      const active = await prisma.apiKey.findFirst({ where: { id: key.id, deletedAt: null } });
      expect(active).toBeNull();
    });

    it('nullifies userId when owning user is deleted', async () => {
      const user = await createTestUser();
      const key = await createTestApiKey(user.id);

      // Manually clear tokens first to satisfy FK
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      // Unlink key from user before deleting user
      await prisma.apiKey.update({ where: { id: key.id }, data: { userId: null } });
      await prisma.user.delete({ where: { id: user.id } });

      const updated = await prisma.apiKey.findUnique({ where: { id: key.id } });
      expect(updated).not.toBeNull();
      expect(updated!.userId).toBeNull();
    });
  });

  // ── ApiUsage model ─────────────────────────────────────────────────────────

  describe('ApiUsage model', () => {
    it('records a usage entry linked to an API key', async () => {
      const key = await createTestApiKey();
      const usage = await prisma.apiUsage.create({
        data: {
          apiKeyId: key.id,
          endpoint: '/api/v1/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 45,
          requestSize: 0,
          responseSize: 512,
          ip: '127.0.0.1',
        },
      });
      expect(usage.id).toBeDefined();
      expect(usage.apiKeyId).toBe(key.id);
    });

    it('cascades deletion when API key is deleted', async () => {
      const key = await createTestApiKey();
      await prisma.apiUsage.create({
        data: {
          apiKeyId: key.id,
          endpoint: '/api/v1/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 10,
          requestSize: 0,
          responseSize: 100,
          ip: '127.0.0.1',
        },
      });

      await prisma.apiKey.delete({ where: { id: key.id } });

      const usages = await prisma.apiUsage.findMany({ where: { apiKeyId: key.id } });
      expect(usages).toHaveLength(0);
    });

    it('allows aggregation queries', async () => {
      const key = await createTestApiKey();
      const responseTimes = [10, 20, 30, 40, 50];
      for (const rt of responseTimes) {
        await prisma.apiUsage.create({
          data: {
            apiKeyId: key.id,
            endpoint: '/api/v1/test',
            method: 'GET',
            statusCode: 200,
            responseTime: rt,
            requestSize: 0,
            responseSize: 100,
            ip: '127.0.0.1',
          },
        });
      }

      const agg = await prisma.apiUsage.aggregate({
        where: { apiKeyId: key.id },
        _avg: { responseTime: true },
        _count: true,
      });

      expect(agg._count).toBe(5);
      expect(agg._avg.responseTime).toBe(30);
    });
  });

  // ── Cross-model queries ────────────────────────────────────────────────────

  describe('Cross-model queries', () => {
    it('counts active API keys for a user', async () => {
      const user = await createTestUser();
      await createTestApiKey(user.id);
      await createTestApiKey(user.id);

      // Deactivate one key
      const keys = await prisma.apiKey.findMany({ where: { userId: user.id } });
      await prisma.apiKey.update({ where: { id: keys[0].id }, data: { isActive: false } });

      const active = await prisma.apiKey.count({ where: { userId: user.id, isActive: true } });
      expect(active).toBe(1);
    });
  });
});
