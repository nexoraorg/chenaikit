#!/usr/bin/env ts-node

/**
 * Migration CLI Script
 * Command-line interface for database migration management
 */

import { PrismaClient } from '@prisma/client';
import { MigrationService } from '../services/migrationService';
import { log } from '../utils/logger';

const prisma = new PrismaClient();
const migrationService = new MigrationService(prisma);

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;
      case 'list':
        await listMigrations();
        break;
      case 'history':
        await showHistory(args[0]);
        break;
      case 'up':
      case 'migrate':
        await runMigration(args[0]);
        break;
      case 'create':
        await createMigration(args[0]);
        break;
      case 'reset':
        await resetDatabase();
        break;
      case 'validate':
        await validateMigrations();
        break;
      case 'report':
        await generateReport();
        break;
      case 'rollback':
        await rollbackMigration(args[0], args[1]);
        break;
      case 'help':
      default:
        showHelp();
    }
  } catch (error) {
    log.error('Migration command failed', error as Error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function showStatus() {
  const status = await migrationService.getStatus();
  
  console.log('\n📊 Migration Status');
  console.log('==================');
  console.log(`Database URL: ${status.databaseUrl}`);
  console.log(`Pending: ${status.pending}`);
  console.log(`Applied: ${status.applied}`);
  console.log(`Rolled Back: ${status.rolledBack}`);
  console.log(`Latest Migration: ${status.latestMigration || 'None'}`);
  console.log();
}

async function listMigrations() {
  const migrations = await migrationService.getMigrations();
  
  console.log('\n📋 Migrations');
  console.log('=============');
  
  if (migrations.length === 0) {
    console.log('No migrations found.');
  } else {
    migrations.forEach((migration, index) => {
      const statusIcon = migration.status === 'applied' ? '✅' : 
                        migration.status === 'pending' ? '⏳' : '⏪';
      console.log(`${index + 1}. ${statusIcon} ${migration.name}`);
      console.log(`   Status: ${migration.status}`);
      console.log(`   Timestamp: ${migration.timestamp}`);
      if (migration.appliedAt) {
        console.log(`   Applied: ${migration.appliedAt.toISOString()}`);
      }
      if (migration.rolledBackAt) {
        console.log(`   Rolled Back: ${migration.rolledBackAt.toISOString()}`);
      }
      console.log();
    });
  }
}

async function showHistory(migrationName?: string) {
  const history = await migrationService.getMigrationHistory(migrationName);
  
  console.log('\n📜 Migration History');
  console.log('====================');
  
  if (history.length === 0) {
    console.log('No migration history found.');
  } else {
    history.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.migrationName}`);
      console.log(`   ID: ${entry.id}`);
      console.log(`   Applied: ${entry.appliedAt.toISOString()}`);
      console.log(`   Execution Time: ${entry.executionTimeMs}ms`);
      console.log(`   Checksum: ${entry.checksum}`);
      if (entry.rolledBackAt) {
        console.log(`   Rolled Back: ${entry.rolledBackAt.toISOString()}`);
      }
      console.log();
    });
  }
}

async function runMigration(name?: string) {
  console.log(`\n🚀 Running migration${name ? `: ${name}` : 's (all pending)'}`);
  await migrationService.runMigration(name);
  console.log('✅ Migration completed successfully');
}

async function createMigration(name: string) {
  if (!name) {
    console.error('❌ Migration name is required');
    console.log('Usage: npm run migrate create <migration-name>');
    process.exit(1);
  }
  
  console.log(`\n📝 Creating migration: ${name}`);
  const migrationName = await migrationService.createMigration(name);
  console.log(`✅ Migration created: ${migrationName}`);
}

async function resetDatabase() {
  console.log('\n⚠️  WARNING: This will drop all data!');
  console.log('Type "yes" to confirm:');
  
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  
  await new Promise<void>((resolve) => {
    stdin.once('data', (data) => {
      if (data.toString().trim() === 'yes') {
        resolve();
      } else {
        console.log('❌ Database reset cancelled');
        process.exit(0);
      }
    });
  });
  
  stdin.setRawMode(false);
  stdin.pause();
  
  await migrationService.resetDatabase();
  console.log('✅ Database reset successfully');
}

async function validateMigrations() {
  console.log('\n🔍 Validating migrations');
  const validation = await migrationService.validateMigrations();
  
  if (validation.valid) {
    console.log('✅ All migrations are valid');
  } else {
    console.log('❌ Migration validation failed');
    validation.errors.forEach((error) => console.log(`  - ${error}`));
    process.exit(1);
  }
}

async function generateReport() {
  console.log('\n📊 Migration Report');
  console.log('==================');
  
  const report = await migrationService.generateReport();
  
  console.log('\nSummary:');
  console.log(`  Total: ${report.summary.total}`);
  console.log(`  Applied: ${report.summary.applied}`);
  console.log(`  Pending: ${report.summary.pending}`);
  console.log(`  Rolled Back: ${report.summary.rolledBack}`);
  
  console.log('\nValidation:');
  console.log(`  Valid: ${report.validation.valid ? '✅' : '❌'}`);
  if (!report.validation.valid) {
    report.validation.errors.forEach((error) => console.log(`  - ${error}`));
  }
  
  console.log(`\nHistory Entries: ${report.history.length}`);
  console.log();
}

async function rollbackMigration(steps?: string, target?: string) {
  console.log('\n⏪ Rolling back migration');
  
  if (target) {
    console.log(`Rolling back to: ${target}`);
    await migrationService.rollbackTo(target);
  } else {
    const stepCount = steps ? parseInt(steps) : 1;
    console.log(`Rolling back ${stepCount} migration(s)`);
    await migrationService.rollback(stepCount);
  }
  
  console.log('✅ Rollback completed');
}

function showHelp() {
  console.log('\n📚 Migration CLI Help');
  console.log('=====================');
  console.log('\nCommands:');
  console.log('  status              Show migration status');
  console.log('  list                List all migrations');
  console.log('  history [name]      Show migration history');
  console.log('  up [name]           Run migration(s)');
  console.log('  migrate [name]      Alias for up');
  console.log('  create <name>       Create new migration');
  console.log('  reset               Reset database (dangerous)');
  console.log('  validate            Validate migration files');
  console.log('  report              Generate migration report');
  console.log('  rollback [steps]    Rollback last N migrations');
  console.log('  rollback to <name>  Rollback to specific migration');
  console.log('  help                Show this help message');
  console.log('\nExamples:');
  console.log('  npm run migrate status');
  console.log('  npm run migrate up');
  console.log('  npm run migrate create add_user_table');
  console.log('  npm run migrate history 20251004160526_init');
  console.log('  npm run migrate rollback 1');
  console.log('  npm run migrate rollback to 20251004160526_init');
  console.log();
}

main();
