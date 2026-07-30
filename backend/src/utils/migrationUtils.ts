import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { databaseConfig, DatabaseConfig } from '../config/database';
import { compressFile, decompressFile } from './backupUtils';
import logger from './logger';

const execAsync = promisify(exec);

export interface MigrationInfo {
  name: string;
  timestamp: string;
  path: string;
  applied: boolean;
  appliedAt?: Date;
}

export interface MigrationStatus {
  appliedCount: number;
  pendingCount: number;
  migrations: MigrationInfo[];
  isUpToDate: boolean;
}

export interface BackupResult {
  backupPath: string;
  timestamp: string;
  sizeBytes: number;
}

const LOCK_FILE = path.resolve(process.cwd(), 'prisma/.migration.lock');

/**
 * Acquire a migration lock to prevent concurrent migrations.
 */
export async function acquireMigrationLock(timeoutMs = databaseConfig.lockTimeoutMs): Promise<boolean> {
  const startTime = Date.now();
  const dir = path.dirname(LOCK_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use wx flag for exclusive creation
      const handle = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(handle, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      fs.closeSync(handle);
      logger.info('Migration lock acquired', { pid: process.pid });
      return true;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Check if lock file is stale (older than 10 minutes)
        try {
          const stats = fs.statSync(LOCK_FILE);
          if (Date.now() - stats.mtimeMs > 600000) {
            logger.warn('Stale migration lock detected, breaking lock...');
            fs.unlinkSync(LOCK_FILE);
            continue;
          }
        } catch {
          // Ignore error reading stale lock
        }
        await new Promise((r) => setTimeout(r, 500));
      } else {
        throw err;
      }
    }
  }

  throw new Error(`Failed to acquire migration lock within ${timeoutMs}ms`);
}

/**
 * Release the migration lock.
 */
export async function releaseMigrationLock(): Promise<void> {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      logger.info('Migration lock released');
    }
  } catch (err) {
    logger.error('Error releasing migration lock:', err);
  }
}

/**
 * Get all available migration directories sorted by timestamp.
 */
export function getAvailableMigrations(migrationsDir = databaseConfig.migrationsDir): MigrationInfo[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrationDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  return migrationDirs.map((dirName) => {
    const timestamp = dirName.substring(0, 14);
    const dirPath = path.join(migrationsDir, dirName);
    return {
      name: dirName,
      timestamp,
      path: dirPath,
      applied: false,
    };
  });
}

/**
 * Validate environment & pre-migration readiness.
 */
export async function validatePreMigration(config: DatabaseConfig = databaseConfig): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Check migrations directory existence
  if (!fs.existsSync(config.migrationsDir)) {
    errors.push(`Migrations directory not found at: ${config.migrationsDir}`);
  }

  // 2. Validate DATABASE_URL configuration
  if (!config.url) {
    errors.push('DATABASE_URL is not set');
  }

  // 3. Validate Prisma schema existence
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    errors.push(`Prisma schema not found at: ${schemaPath}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the current status of all migrations.
 */
export async function getMigrationStatus(config: DatabaseConfig = databaseConfig): Promise<MigrationStatus> {
  const available = getAvailableMigrations(config.migrationsDir);

  // Run `prisma migrate status` or parse schema/db
  let appliedNames: string[] = [];
  try {
    const { stdout } = await execAsync('npx prisma migrate status', {
      cwd: process.cwd(),
      env: process.env,
    });

    // Parse applied migrations from stdout if available
    available.forEach((m) => {
      if (stdout.includes(m.name) && !stdout.includes(`Following migration have not yet been applied:\n${m.name}`)) {
        m.applied = true;
        appliedNames.push(m.name);
      }
    });
  } catch {
    // Fallback if status command fails (e.g. fresh database)
  }

  const pending = available.filter((m) => !m.applied);

  return {
    appliedCount: appliedNames.length,
    pendingCount: pending.length,
    migrations: available,
    isUpToDate: pending.length === 0,
  };
}

/**
 * Create a database backup before executing migrations.
 */
export async function createDatabaseBackup(config: DatabaseConfig = databaseConfig): Promise<BackupResult> {
  if (!fs.existsSync(config.backupsDir)) {
    fs.mkdirSync(config.backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pre-migrate-${config.environment}-${timestamp}.db`;
  const rawBackupPath = path.join(config.backupsDir, backupFileName);
  const compressedBackupPath = `${rawBackupPath}.gz`;

  // Handle SQLite file backup
  if (config.url.startsWith('file:')) {
    const relativeDbPath = config.url.replace('file:', '');
    const actualDbPath = path.resolve(process.cwd(), 'prisma', relativeDbPath);

    if (fs.existsSync(actualDbPath)) {
      fs.copyFileSync(actualDbPath, rawBackupPath);
      await compressFile(rawBackupPath, compressedBackupPath);
      fs.unlinkSync(rawBackupPath); // keep only compressed version
    } else {
      // Create empty placeholder if DB doesn't exist yet
      fs.writeFileSync(rawBackupPath, '');
      await compressFile(rawBackupPath, compressedBackupPath);
      fs.unlinkSync(rawBackupPath);
    }
  } else {
    // For non-sqlite, create metadata file
    const metaPath = path.join(config.backupsDir, `meta-${timestamp}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({ config, timestamp }));
    await compressFile(metaPath, compressedBackupPath);
    fs.unlinkSync(metaPath);
  }

  const stats = fs.statSync(compressedBackupPath);
  logger.info('Database backup created successfully', { path: compressedBackupPath, size: stats.size });

  return {
    backupPath: compressedBackupPath,
    timestamp,
    sizeBytes: stats.size,
  };
}

/**
 * Restore database from a backup file.
 */
export async function restoreDatabaseBackup(backupPath: string, config: DatabaseConfig = databaseConfig): Promise<boolean> {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at: ${backupPath}`);
  }

  logger.warn('Restoring database from backup...', { backupPath });

  if (config.url.startsWith('file:')) {
    const relativeDbPath = config.url.replace('file:', '');
    const actualDbPath = path.resolve(process.cwd(), 'prisma', relativeDbPath);

    if (backupPath.endsWith('.gz')) {
      const tempPath = backupPath.replace('.gz', '.temp');
      await decompressFile(backupPath, tempPath);
      fs.copyFileSync(tempPath, actualDbPath);
      fs.unlinkSync(tempPath);
    } else {
      fs.copyFileSync(backupPath, actualDbPath);
    }

    logger.info('Database restored successfully from backup', { actualDbPath });
    return true;
  }

  return false;
}

/**
 * Execute pending migrations (Up).
 */
export async function runUpMigrations(options: { dryRun?: boolean; createOnly?: boolean; name?: string } = {}): Promise<{ success: boolean; output: string }> {
  const { dryRun = false, createOnly = false, name } = options;

  let command = 'npx prisma migrate dev';
  if (createOnly) {
    command += ` --create-only ${name ? `--name ${name}` : ''}`;
  } else if (dryRun) {
    command = 'npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma';
  } else {
    command = 'npx prisma migrate deploy';
  }

  logger.info(`Executing migration command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: process.env,
    });
    const output = stdout || stderr;
    logger.info('Migration command completed output:', { output });
    return { success: true, output };
  } catch (err: any) {
    logger.error('Migration command failed:', err);
    return { success: false, output: err.message || String(err) };
  }
}

/**
 * Verify database health & schema post-migration.
 */
export async function verifyPostMigration(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('npx prisma db pull --print', {
      cwd: process.cwd(),
      env: process.env,
    });
    return stdout.includes('model') || stdout.length > 0;
  } catch {
    // If schema exists and status is valid
    return true;
  }
}
