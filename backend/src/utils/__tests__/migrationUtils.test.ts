import fs from 'fs';
import path from 'path';
import {
  acquireMigrationLock,
  releaseMigrationLock,
  getAvailableMigrations,
  validatePreMigration,
  createDatabaseBackup,
  restoreDatabaseBackup,
} from '../migrationUtils';
import { getDatabaseConfig } from '../../config/database';

describe('migrationUtils', () => {
  const testConfig = getDatabaseConfig();

  afterEach(async () => {
    await releaseMigrationLock();
  });

  describe('migration locks', () => {
    it('should acquire and release migration lock', async () => {
      const acquired = await acquireMigrationLock(5000);
      expect(acquired).toBe(true);

      const lockFile = path.resolve(process.cwd(), 'prisma/.migration.lock');
      expect(fs.existsSync(lockFile)).toBe(true);

      await releaseMigrationLock();
      expect(fs.existsSync(lockFile)).toBe(false);
    });
  });

  describe('getAvailableMigrations', () => {
    it('should list available migration directories', () => {
      const migrations = getAvailableMigrations(testConfig.migrationsDir);
      expect(Array.isArray(migrations)).toBe(true);
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0]).toHaveProperty('name');
      expect(migrations[0]).toHaveProperty('path');
      expect(migrations[0]).toHaveProperty('timestamp');
    });
  });

  describe('validatePreMigration', () => {
    it('should validate pre-migration requirements', async () => {
      const result = await validatePreMigration(testConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createDatabaseBackup and restore', () => {
    it('should create database backup and restore from backup file', async () => {
      const backupResult = await createDatabaseBackup(testConfig);
      expect(backupResult).toHaveProperty('backupPath');
      expect(backupResult).toHaveProperty('sizeBytes');
      expect(fs.existsSync(backupResult.backupPath)).toBe(true);

      const restored = await restoreDatabaseBackup(backupResult.backupPath, testConfig);
      expect(restored).toBe(true);

      // Clean up backup file
      if (fs.existsSync(backupResult.backupPath)) {
        fs.unlinkSync(backupResult.backupPath);
      }
    });
  });
});
