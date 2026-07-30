import path from 'path';

export interface DatabaseConfig {
  url: string;
  provider: 'sqlite' | 'postgresql' | 'mysql';
  environment: string;
  autoMigrate: boolean;
  backupBeforeMigrate: boolean;
  enableRollbacks: boolean;
  migrationTimeoutMs: number;
  dryRun: boolean;
  migrationsDir: string;
  backupsDir: string;
  lockTimeoutMs: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  const provider = (process.env.DATABASE_PROVIDER as DatabaseConfig['provider']) || 'sqlite';
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

  const baseDir = path.resolve(process.cwd());

  return {
    url: dbUrl,
    provider,
    environment: env,
    autoMigrate: process.env.AUTO_MIGRATE === 'true' || env === 'development',
    backupBeforeMigrate: process.env.BACKUP_BEFORE_MIGRATE !== 'false',
    enableRollbacks: process.env.ENABLE_ROLLBACKS !== 'false',
    migrationTimeoutMs: parseInt(process.env.MIGRATION_TIMEOUT_MS || '60000', 10),
    dryRun: process.env.DRY_RUN === 'true',
    migrationsDir: path.resolve(baseDir, 'prisma/migrations'),
    backupsDir: path.resolve(baseDir, 'prisma/backups'),
    lockTimeoutMs: parseInt(process.env.MIGRATION_LOCK_TIMEOUT_MS || '30000', 10),
  };
}

export const databaseConfig = getDatabaseConfig();
