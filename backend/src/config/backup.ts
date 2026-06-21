import path from 'node:path'

export const backupConfig = {
  /** Directory where local backup files are stored. */
  dir: process.env.BACKUP_DIR ?? path.resolve(process.cwd(), 'backups'),

  /** AES-256-GCM encryption key as a 64-char hex string (32 bytes). Set to enable encryption. */
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY ?? '',

  /** Cron-style schedule for automated backups (default: every day at 02:00). */
  schedule: process.env.BACKUP_SCHEDULE ?? '0 2 * * *',

  /** How many local backup files to retain before pruning the oldest. */
  retentionCount: (() => {
    const parsed = parseInt(process.env.BACKUP_RETENTION_COUNT ?? '14', 10)
    return Number.isNaN(parsed) || parsed < 1 ? 14 : parsed
  })(),

  /** AWS region for S3 uploads. Required when S3_BUCKET is set. */
  s3Region: process.env.AWS_REGION ?? 'us-east-1',

  /** S3 bucket name for off-site backup storage. Leave blank to skip S3 upload. */
  s3Bucket: process.env.S3_BUCKET ?? '',

  /** S3 key prefix for backup objects (e.g. "chenaikit/db/"). */
  s3Prefix: process.env.S3_BACKUP_PREFIX ?? 'chenaikit/db/',

  /** AWS access key ID. Required when S3_BUCKET is set. */
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',

  /** AWS secret access key. Required when S3_BUCKET is set. */
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',

  /** Path to the SQLite database file. Derived from DATABASE_URL by default. */
  get dbPath(): string {
    const url = process.env.DATABASE_URL ?? ''
    if (!url) throw new Error('DATABASE_URL environment variable is required')
    // SQLite URLs: "file:./dev.db" or "/absolute/path/to/app.db"
    const match = url.match(/^file:(.+)$/)
    return match ? path.resolve(match[1]) : path.resolve(url)
  },
}

export type BackupConfig = typeof backupConfig
