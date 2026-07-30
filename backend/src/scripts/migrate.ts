import {
  acquireMigrationLock,
  releaseMigrationLock,
  validatePreMigration,
  getMigrationStatus,
  createDatabaseBackup,
  restoreDatabaseBackup,
  runUpMigrations,
  verifyPostMigration,
} from '../utils/migrationUtils';
import { databaseConfig } from '../config/database';
import logger from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || databaseConfig.dryRun;
  const isStatusOnly = args.includes('--status-only');
  const isCreateOnly = args.includes('--create-only');
  const skipBackup = args.includes('--skip-backup');

  const nameIndex = args.indexOf('--name');
  const migrationName = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;

  logger.info('=== Starting Database Migration Pipeline ===', { environment: databaseConfig.environment });

  // 1. Validate Pre-migration
  const validation = await validatePreMigration(databaseConfig);
  if (!validation.valid) {
    logger.error('Pre-migration validation failed:', { errors: validation.errors });
    process.exit(1);
  }

  // 2. Display Status
  const status = await getMigrationStatus(databaseConfig);
  logger.info(`Migration Status: ${status.appliedCount} applied, ${status.pendingCount} pending.`);

  if (isStatusOnly) {
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }

  if (status.isUpToDate && !isCreateOnly && !isDryRun) {
    logger.info('Database is up to date. No pending migrations to apply.');
    process.exit(0);
  }

  let backupPath: string | null = null;

  try {
    // 3. Acquire Lock
    await acquireMigrationLock();

    // 4. Create Backup before migration
    if (!skipBackup && !isDryRun && databaseConfig.backupBeforeMigrate) {
      logger.info('Creating database backup prior to migration...');
      const backupResult = await createDatabaseBackup(databaseConfig);
      backupPath = backupResult.backupPath;
    }

    // 5. Run Up Migrations
    logger.info('Running database migrations...', { dryRun: isDryRun, createOnly: isCreateOnly });
    const result = await runUpMigrations({ dryRun: isDryRun, createOnly: isCreateOnly, name: migrationName });

    if (!result.success) {
      throw new Error(`Migration execution failed: ${result.output}`);
    }

    // 6. Post-migration Verification
    if (!isDryRun && !isCreateOnly) {
      const verified = await verifyPostMigration();
      if (!verified) {
        throw new Error('Post-migration verification failed! Database schema integrity mismatch.');
      }
      logger.info('Post-migration verification succeeded.');
    }

    logger.info('=== Database Migration Pipeline Completed Successfully ===');
  } catch (error: any) {
    logger.error('Migration failed:', { error: error.message || String(error) });

    // Automatic rollback / restore on failure
    if (backupPath && databaseConfig.enableRollbacks) {
      logger.warn('Triggering automatic rollback/restore from backup...');
      try {
        await restoreDatabaseBackup(backupPath, databaseConfig);
        logger.info('Database successfully restored to pre-migration state.');
      } catch (restoreErr) {
        logger.error('Fatal: Automatic rollback failed!', { error: restoreErr });
      }
    }

    process.exit(1);
  } finally {
    // 7. Release Lock
    await releaseMigrationLock();
  }
}

if (require.main === module) {
  main();
}
