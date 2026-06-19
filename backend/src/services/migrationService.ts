/**
 * Migration Service
 * Enhanced database migration management on top of Prisma
 */

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log } from '../utils/logger';
import { DatabaseError, ValidationError } from '../utils/errors';

const execAsync = promisify(exec);

export interface MigrationInfo {
  name: string;
  timestamp: string;
  status: 'pending' | 'applied' | 'rolled_back';
  appliedAt?: Date;
  rolledBackAt?: Date;
  checksum?: string;
}

export interface MigrationHistory {
  id: string;
  migrationName: string;
  appliedAt: Date;
  rolledBackAt?: Date;
  checksum: string;
  executionTimeMs: number;
}

export class MigrationService {
  private migrationsPath: string;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, migrationsPath?: string) {
    this.prisma = prisma;
    this.migrationsPath = migrationsPath || path.join(process.cwd(), 'prisma', 'migrations');
  }

  /**
   * Get list of all migrations
   */
  async getMigrations(): Promise<MigrationInfo[]> {
    try {
      const migrationsDir = await fs.readdir(this.migrationsPath);
      const migrations: MigrationInfo[] = [];

      for (const item of migrationsDir) {
        const itemPath = path.join(this.migrationsPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory() && item.match(/^\d{17}_/)) {
          const migrationName = item;
          const timestamp = item.substring(0, 17);
          
          // Check if migration is applied
          const appliedMigration = await this.getMigrationHistory(migrationName);
          
          migrations.push({
            name: migrationName,
            timestamp,
            status: appliedMigration ? 'applied' : 'pending',
            appliedAt: appliedMigration?.appliedAt,
            rolledBackAt: appliedMigration?.rolledBackAt,
            checksum: appliedMigration?.checksum,
          });
        }
      }

      return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      log.error('Failed to get migrations', error as Error);
      throw new DatabaseError('Failed to read migrations directory');
    }
  }

  /**
   * Get migration history from database
   */
  async getMigrationHistory(migrationName?: string): Promise<MigrationHistory[]> {
    try {
      // Check if _prisma_migrations table exists
      const tableExists = await this.checkTableExists('_prisma_migrations');
      
      if (!tableExists) {
        return [];
      }

      const where = migrationName ? { migration_name: migrationName } : {};
      
      const migrations = await this.prisma.$queryRaw<Array<any>>`
        SELECT * FROM _prisma_migrations
        ${migrationName ? `WHERE migration_name = ${migrationName}` : ''}
        ORDER BY started_at DESC
      `;

      return migrations.map((m: any) => ({
        id: m.id,
        migrationName: m.migration_name,
        appliedAt: new Date(m.finished_at),
        rolledBackAt: m.rolled_back_at ? new Date(m.rolled_back_at) : undefined,
        checksum: m.checksum,
        executionTimeMs: m.applied_steps_count,
      }));
    } catch (error) {
      log.error('Failed to get migration history', error as Error);
      return [];
    }
  }

  /**
   * Check if a table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=${tableName}
      `;
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run Prisma migration
   */
  async runMigration(name?: string): Promise<void> {
    try {
      log.info('Starting migration', { name: name || 'all pending' });

      const command = name 
        ? `npx prisma migrate deploy --name ${name}`
        : 'npx prisma migrate deploy';

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });

      if (stderr && !stderr.includes('warning')) {
        log.warn('Migration warnings', { stderr });
      }

      log.info('Migration completed successfully', { stdout });
    } catch (error) {
      log.error('Migration failed', error as Error);
      throw new DatabaseError('Migration failed', { originalError: (error as Error).message });
    }
  }

  /**
   * Create a new migration
   */
  async createMigration(name: string): Promise<string> {
    try {
      log.info('Creating migration', { name });

      const command = `npx prisma migrate dev --name ${name} --create-only`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });

      if (stderr && !stderr.includes('warning')) {
        log.warn('Migration creation warnings', { stderr });
      }

      // Extract the migration name from output
      const match = stdout.match(/Migration.*created: (.+)/);
      const migrationName = match ? match[1].trim() : name;

      log.info('Migration created successfully', { migrationName });
      return migrationName;
    } catch (error) {
      log.error('Migration creation failed', error as Error);
      throw new DatabaseError('Failed to create migration', { originalError: (error as Error).message });
    }
  }

  /**
   * Reset database (dangerous - drops all data)
   */
  async resetDatabase(): Promise<void> {
    try {
      log.warn('Resetting database - this will drop all data');

      const command = 'npx prisma migrate reset --force';
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });

      if (stderr && !stderr.includes('warning')) {
        log.warn('Database reset warnings', { stderr });
      }

      log.info('Database reset successfully', { stdout });
    } catch (error) {
      log.error('Database reset failed', error as Error);
      throw new DatabaseError('Failed to reset database', { originalError: (error as Error).message });
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    pending: number;
    applied: number;
    rolledBack: number;
    latestMigration?: string;
    databaseUrl: string;
  }> {
    try {
      const migrations = await this.getMigrations();
      const history = await this.getMigrationHistory();

      const pending = migrations.filter(m => m.status === 'pending').length;
      const applied = migrations.filter(m => m.status === 'applied').length;
      const rolledBack = migrations.filter(m => m.status === 'rolled_back').length;
      const latestMigration = migrations.length > 0 ? migrations[migrations.length - 1].name : undefined;

      return {
        pending,
        applied,
        rolledBack,
        latestMigration,
        databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
      };
    } catch (error) {
      log.error('Failed to get migration status', error as Error);
      throw new DatabaseError('Failed to get migration status');
    }
  }

  /**
   * Validate migration files
   */
  async validateMigrations(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      const migrations = await this.getMigrations();
      const errors: string[] = [];

      for (const migration of migrations) {
        const migrationPath = path.join(this.migrationsPath, migration.name, 'migration.sql');
        
        try {
          await fs.access(migrationPath);
        } catch {
          errors.push(`Migration ${migration.name} is missing migration.sql file`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      log.error('Failed to validate migrations', error as Error);
      return {
        valid: false,
        errors: ['Failed to validate migrations'],
      };
    }
  }

  /**
   * Generate migration report
   */
  async generateReport(): Promise<{
    summary: {
      total: number;
      applied: number;
      pending: number;
      rolledBack: number;
    };
    migrations: MigrationInfo[];
    history: MigrationHistory[];
    validation: { valid: boolean; errors: string[] };
  }> {
    try {
      const migrations = await this.getMigrations();
      const history = await this.getMigrationHistory();
      const validation = await this.validateMigrations();

      return {
        summary: {
          total: migrations.length,
          applied: migrations.filter(m => m.status === 'applied').length,
          pending: migrations.filter(m => m.status === 'pending').length,
          rolledBack: migrations.filter(m => m.status === 'rolled_back').length,
        },
        migrations,
        history,
        validation,
      };
    } catch (error) {
      log.error('Failed to generate migration report', error as Error);
      throw new DatabaseError('Failed to generate migration report');
    }
  }

  /**
   * Rollback last migration (SQLite limited support)
   * Note: SQLite has limited rollback support compared to PostgreSQL
   */
  async rollback(steps: number = 1): Promise<void> {
    try {
      log.warn('Rolling back migrations', { steps });

      // SQLite doesn't support true rollback like PostgreSQL
      // We can only provide limited rollback by resetting to a previous state
      // This is a simplified approach for SQLite
      
      const history = await this.getMigrationHistory();
      if (history.length === 0) {
        throw new ValidationError('No migrations to rollback');
      }

      const migrationsToRollback = history.slice(0, steps);
      log.info('Rolling back migrations', { 
        count: migrationsToRollback.length,
        migrations: migrationsToRollback.map(m => m.migrationName)
      });

      // For SQLite, we need to manually handle rollback
      // This is a simplified approach - in production, consider using a database with better rollback support
      for (const migration of migrationsToRollback) {
        await this.prisma.$executeRaw`
          UPDATE _prisma_migrations 
          SET rolled_back_at = ${new Date().toISOString()}
          WHERE migration_name = ${migration.migrationName}
        `;
      }

      log.info('Rollback completed', { steps });
    } catch (error) {
      log.error('Rollback failed', error as Error);
      throw new DatabaseError('Rollback failed', { originalError: (error as Error).message });
    }
  }

  /**
   * Rollback to specific migration
   */
  async rollbackTo(migrationName: string): Promise<void> {
    try {
      const history = await this.getMigrationHistory();
      const targetIndex = history.findIndex(m => m.migrationName === migrationName);
      
      if (targetIndex === -1) {
        throw new ValidationError('Migration not found in history');
      }

      const steps = targetIndex + 1;
      await this.rollback(steps);
    } catch (error) {
      log.error('Rollback to migration failed', error as Error);
      throw new DatabaseError('Rollback to migration failed', { originalError: (error as Error).message });
    }
  }
}
