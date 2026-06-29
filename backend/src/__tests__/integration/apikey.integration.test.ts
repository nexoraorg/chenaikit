/**
 * ApiKeyService integration tests
 *
 * Tests the ApiKeyService against the real SQLite test database to verify
 * that CRUD operations, key validation, quota tracking, and cleanup all
 * work correctly end-to-end.
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ApiKeyService } from '../../services/apiKeyService';
import { cleanDatabase, getTestPrisma } from '../setup';

const prisma: PrismaClient = getTestPrisma();
let service: ApiKeyService;

describe('ApiKeyService – database integration', () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
    service = new ApiKeyService(prisma);
  }, 30000);

  // ── createApiKey ───────────────────────────────────────────────────────────

  describe('createApiKey', () => {
    it('persists a new key and returns the plain-text key', async () => {
      const { apiKey, plainKey } = await service.createApiKey({ name: 'My Key' });

      expect(apiKey.id).toBeDefined();
      expect(apiKey.name).toBe('My Key');
      expect(apiKey.tier).toBe('FREE');
      expect(plainKey).toMatch(/^ck_[a-f0-9]{64}$/);
    });

    it('stores only the hash, never the plain key', async () => {
      const { plainKey } = await service.createApiKey({ name: 'Hash Test' });

      const row = await prisma.apiKey.findFirst({ where: { name: 'Hash Test' } });
      expect(row!.keyHash).not.toBe(plainKey);
      expect(row!.keyHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('creates a key with PRO tier and quota', async () => {
      const { apiKey } = await service.createApiKey({
        name: 'Pro Key',
        tier: 'PRO',
        usageQuota: 5000,
      });

      expect(apiKey.tier).toBe('PRO');
      expect(apiKey.usageQuota).toBe(5000);
    });
  });

  // ── validateApiKey ─────────────────────────────────────────────────────────

  describe('validateApiKey', () => {
    it('returns the key object for a valid, active key', async () => {
      const { plainKey } = await service.createApiKey({ name: 'Valid Key' });

      const result = await service.validateApiKey(plainKey);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Valid Key');
    });

    it('returns null for an incorrect key', async () => {
      const result = await service.validateApiKey('ck_notavalidkey');
      expect(result).toBeNull();
    });

    it('returns null and deactivates an expired key', async () => {
      const { plainKey, apiKey } = await service.createApiKey({
        name: 'Expired Key',
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      const result = await service.validateApiKey(plainKey);
      expect(result).toBeNull();

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(row!.isActive).toBe(false);
    });

    it('updates lastUsedAt on successful validation', async () => {
      const { plainKey, apiKey } = await service.createApiKey({ name: 'Usage Key' });
      const before = new Date(apiKey.lastUsedAt ?? 0);

      await new Promise((r) => setTimeout(r, 10)); // ensure timestamp changes
      await service.validateApiKey(plainKey);

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(new Date(row!.lastUsedAt!).getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // ── getApiKeyById ──────────────────────────────────────────────────────────

  describe('getApiKeyById', () => {
    it('returns the key when it exists', async () => {
      const { apiKey } = await service.createApiKey({ name: 'Find Me' });
      const found = await service.getApiKeyById(apiKey.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(apiKey.id);
    });

    it('returns null for a non-existent id', async () => {
      const result = await service.getApiKeyById('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  // ── getApiKeysByUserId ─────────────────────────────────────────────────────

  describe('getApiKeysByUserId', () => {
    it('returns all non-deleted keys for a user', async () => {
      // Create a real user first so the FK constraint is satisfied
      const user = await prisma.user.create({
        data: {
          email: `apikey-user-${Date.now()}@test.com`,
          password: 'hashed',
          role: 'user',
        },
      });
      const userId = user.id;

      await service.createApiKey({ name: 'K1', userId });
      await service.createApiKey({ name: 'K2', userId });
      const { apiKey: k3 } = await service.createApiKey({ name: 'K3', userId });
      await service.deleteApiKey(k3.id); // soft-deleted, should be excluded

      const keys = await service.getApiKeysByUserId(userId);
      expect(keys).toHaveLength(2);
    });
  });

  // ── updateApiKey ───────────────────────────────────────────────────────────

  describe('updateApiKey', () => {
    it('updates the name and tier', async () => {
      const { apiKey } = await service.createApiKey({ name: 'Old Name' });

      const updated = await service.updateApiKey(apiKey.id, {
        name: 'New Name',
        tier: 'ENTERPRISE',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.tier).toBe('ENTERPRISE');
    });

    it('can deactivate a key', async () => {
      const { apiKey } = await service.createApiKey({ name: 'To Deactivate' });
      await service.updateApiKey(apiKey.id, { isActive: false });

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(row!.isActive).toBe(false);
    });
  });

  // ── deactivateApiKey ───────────────────────────────────────────────────────

  describe('deactivateApiKey', () => {
    it('sets isActive to false', async () => {
      const { apiKey } = await service.createApiKey({ name: 'Active' });
      await service.deactivateApiKey(apiKey.id);

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(row!.isActive).toBe(false);
    });

    it('causes validateApiKey to return null', async () => {
      const { apiKey, plainKey } = await service.createApiKey({ name: 'Deactivate Test' });
      await service.deactivateApiKey(apiKey.id);

      const result = await service.validateApiKey(plainKey);
      expect(result).toBeNull();
    });
  });

  // ── deleteApiKey (soft delete) ─────────────────────────────────────────────

  describe('deleteApiKey', () => {
    it('sets isActive=false and deletedAt', async () => {
      const { apiKey } = await service.createApiKey({ name: 'To Delete' });
      await service.deleteApiKey(apiKey.id);

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(row!.isActive).toBe(false);
      expect(row!.deletedAt).not.toBeNull();
    });
  });

  // ── incrementUsage ─────────────────────────────────────────────────────────

  describe('incrementUsage', () => {
    it('increments currentUsage by 1', async () => {
      const { apiKey } = await service.createApiKey({ name: 'Usage Inc' });
      await service.incrementUsage(apiKey.id);
      await service.incrementUsage(apiKey.id);

      const row = await prisma.apiKey.findUnique({ where: { id: apiKey.id } });
      expect(row!.currentUsage).toBe(2);
    });
  });

  // ── cleanupExpiredKeys ─────────────────────────────────────────────────────

  describe('cleanupExpiredKeys', () => {
    it('deactivates expired keys and returns the count', async () => {
      await service.createApiKey({ name: 'Expired1', expiresAt: new Date(Date.now() - 1000) });
      await service.createApiKey({ name: 'Expired2', expiresAt: new Date(Date.now() - 2000) });
      await service.createApiKey({ name: 'Active' }); // no expiry

      const count = await service.cleanupExpiredKeys();
      expect(count).toBe(2);

      const stillActive = await prisma.apiKey.count({ where: { name: 'Active', isActive: true } });
      expect(stillActive).toBe(1);
    });
  });
});
