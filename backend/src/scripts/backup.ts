#!/usr/bin/env node
/**
 * Manual backup CLI
 *
 * Usage:
 *   npx ts-node src/scripts/backup.ts
 *   node dist/scripts/backup.js
 *
 * Environment variables:
 *   DATABASE_URL              SQLite database file URL (e.g. file:./dev.db)
 *   BACKUP_DIR                Directory for local backup files (default: ./backups)
 *   BACKUP_ENCRYPTION_KEY     64-char hex key for AES-256-GCM encryption (optional)
 *   S3_BUCKET                 S3 bucket name for off-site storage (optional)
 *   S3_BACKUP_PREFIX          S3 key prefix (default: chenaikit/db/)
 *   AWS_REGION                AWS region (default: us-east-1)
 *   AWS_ACCESS_KEY_ID         AWS access key (required when S3_BUCKET is set)
 *   AWS_SECRET_ACCESS_KEY     AWS secret key (required when S3_BUCKET is set)
 *   BACKUP_RETENTION_COUNT    Local files to keep (default: 14)
 */
import 'dotenv/config'
import { backupService } from '../services/backupService'

async function main() {
  console.log('Starting manual database backup...')
  try {
    const result = await backupService.createBackup()
    console.log('Backup completed successfully:')
    console.log(`  File:         ${result.localPath}`)
    console.log(`  Size:         ${(result.sizeBytes / 1024).toFixed(1)} KB`)
    console.log(`  Encrypted:    ${result.encrypted}`)
    console.log(`  Uploaded S3:  ${result.uploadedToS3}`)
    console.log(`  Duration:     ${result.durationMs}ms`)
    process.exit(0)
  } catch (err) {
    console.error('Backup failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
