#!/usr/bin/env node
/**
 * Database restore CLI
 *
 * Usage:
 *   npx ts-node src/scripts/restore.ts <source>
 *   node dist/scripts/restore.js <source>
 *
 * <source> is one of:
 *   - An absolute or relative path to a local backup file
 *   - An S3 key (e.g. "chenaikit/db/backup-2026-06-19T02-00-00Z.enc.gz")
 *
 * The script will:
 *   1. Fetch the backup file (from disk or S3)
 *   2. Decrypt it if BACKUP_ENCRYPTION_KEY is set and the filename contains ".enc."
 *   3. Decompress the gzip archive
 *   4. Verify SQLite integrity
 *   5. Atomically replace the live database file
 *
 * WARNING: This will overwrite the current database. Ensure all application
 * connections are closed before running in production.
 */
import 'dotenv/config'
import { backupService } from '../services/backupService'

async function main() {
  const source = process.argv[2]

  if (!source) {
    console.error('Usage: restore <backup-file-or-s3-key>')
    console.error('')
    console.error('Examples:')
    console.error('  restore ./backups/backup-2026-06-19T02-00-00Z.enc.gz')
    console.error('  restore chenaikit/db/backup-2026-06-19T02-00-00Z.enc.gz  # S3 key')
    process.exit(1)
  }

  console.log(`Restoring database from: ${source}`)
  console.log('WARNING: This will overwrite the current database.')

  // Give the operator a moment to abort in non-interactive environments
  if (process.env.RESTORE_CONFIRM !== 'yes') {
    console.log('Set RESTORE_CONFIRM=yes to skip this prompt.')
    console.log('Proceeding in 3 seconds... Ctrl+C to abort.')
    await new Promise((r) => setTimeout(r, 3000))
  }

  try {
    const result = await backupService.restore(source)
    console.log('Restore completed successfully:')
    console.log(`  Source:    ${result.restoredFrom}`)
    console.log(`  Duration:  ${result.durationMs}ms`)
    process.exit(0)
  } catch (err) {
    console.error('Restore failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
