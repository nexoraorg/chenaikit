import fs from 'fs';
import path from 'path';
import {
  acquireMigrationLock,
  releaseMigrationLock,
  restoreDatabaseBackup,
  verifyPostMigration,
} from '../utils/migrationUtils';
import { databaseConfig } from '../config/database';
import logger from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const fromBackupIndex = args.indexOf('--from-backup');
  let backupFile = fromBackupIndex !== -1 && args[fromBackupIndex + 1] ? args[fromBackupIndex + 1] : undefined;

  logger.info('=== Starting Database Rollback Pipeline ===');

  try {
    await acquireMigrationLock();

    // Find latest backup if no specific backup was specified
    if (!backupFile) {
      if (!fs.existsSync(databaseConfig.backupsDir)) {
        throw new Error(`Backups directory does not exist at: ${databaseConfig.backupsDir}`);
      }

      const files = fs.readdirSync(databaseConfig.backupsDir)
        .filter((f) => f.startsWith('pre-migrate-') && f.endsWith('.gz'))
        .map((f) => ({
          name: f,
          path: path.join(databaseConfig.backupsDir, f),
          mtime: fs.statSync(path.join(databaseConfig.backupsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) {
        throw new Error('No available database backups found to rollback from.');
      }

      backupFile = files[0].path;
      logger.info(`Selected latest backup for rollback: ${backupFile}`);
    }

    const fullBackupPath = path.isAbsolute(backupFile)
      ? backupFile
      : path.resolve(process.cwd(), backupFile);

    // Perform restore
    const restored = await restoreDatabaseBackup(fullBackupPath, databaseConfig);
    if (!restored) {
      throw new Error('Failed to restore database from backup.');
    }

    // Post-rollback Verification
    const verified = await verifyPostMigration();
    if (!verified) {
      throw new Error('Post-rollback verification failed! Database schema may be corrupted.');
    }

    logger.info('=== Database Rollback Pipeline Completed Successfully ===');
  } catch (error: any) {
    logger.error('Rollback failed:', { error: error.message || String(error) });
    process.exit(1);
  } finally {
    await releaseMigrationLock();
  }
}

if (require.main === module) {
  main();
}
