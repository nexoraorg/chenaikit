import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import Database from 'better-sqlite3'
import { backupConfig } from '../config/backup'
import {
  buildBackupFilename,
  compressFile,
  decompressFile,
  encryptFile,
  decryptFile,
  uploadToS3,
  downloadFromS3,
} from '../utils/backupUtils'
import { winstonLogger as logger } from '../utils/logger'

export interface BackupResult {
  filename: string
  localPath: string
  sizeBytes: number
  encrypted: boolean
  uploadedToS3: boolean
  durationMs: number
}

export interface RestoreResult {
  restoredFrom: string
  durationMs: number
}

export class BackupService {
  private get encrypted(): boolean {
    return backupConfig.encryptionKey.length === 64
  }

  /**
   * Create a live-safe backup of the SQLite database, compress it, optionally
   * encrypt it, and store it locally (and in S3 if configured).
   */
  async createBackup(): Promise<BackupResult> {
    const start = Date.now()
    await fs.promises.mkdir(backupConfig.dir, { recursive: true })

    const tmpRaw = path.join(os.tmpdir(), `chenaikit-backup-raw-${Date.now()}.db`)
    const tmpGz = path.join(os.tmpdir(), `chenaikit-backup-${Date.now()}.gz`)
    const filename = buildBackupFilename(this.encrypted)
    const localPath = path.join(backupConfig.dir, filename)

    try {
      // Step 1: hot backup via SQLite Online Backup API (live-safe, no read lock)
      logger.info('Starting SQLite backup', { dbPath: backupConfig.dbPath })
      await this.sqliteBackup(backupConfig.dbPath, tmpRaw)

      // Step 2: compress
      await compressFile(tmpRaw, tmpGz)

      // Step 3: optionally encrypt
      if (this.encrypted) {
        await encryptFile(tmpGz, localPath, backupConfig.encryptionKey)
      } else {
        await fs.promises.copyFile(tmpGz, localPath)
      }

      const { size: sizeBytes } = await fs.promises.stat(localPath)

      // Step 4: upload to S3 if configured
      let uploadedToS3 = false
      if (backupConfig.s3Bucket && backupConfig.awsAccessKeyId) {
        const s3Key = `${backupConfig.s3Prefix}${filename}`
        logger.info('Uploading backup to S3', { bucket: backupConfig.s3Bucket, key: s3Key })
        await uploadToS3({
          filePath: localPath,
          bucket: backupConfig.s3Bucket,
          key: s3Key,
          region: backupConfig.s3Region,
          accessKeyId: backupConfig.awsAccessKeyId,
          secretAccessKey: backupConfig.awsSecretAccessKey,
        })
        uploadedToS3 = true
        logger.info('Backup uploaded to S3 successfully', { key: s3Key })
      }

      // Step 5: prune old local backups
      await this.pruneLocalBackups()

      const durationMs = Date.now() - start
      const result: BackupResult = { filename, localPath, sizeBytes, encrypted: this.encrypted, uploadedToS3, durationMs }
      logger.info('Backup completed', result)
      return result
    } finally {
      await fs.promises.rm(tmpRaw, { force: true })
      await fs.promises.rm(tmpGz, { force: true })
    }
  }

  /**
   * Restore the database from a local backup file path or an S3 key.
   *
   * @param source  Absolute path to a local backup file, or an S3 key
   *                (detected when the value does not start with '/' or '.').
   */
  async restore(source: string): Promise<RestoreResult> {
    const start = Date.now()
    const isS3Key = source.startsWith('s3://')
    const s3KeyPath = isS3Key ? source.slice(5) : source

    const tmpEncOrGz = path.join(os.tmpdir(), `chenaikit-restore-dl-${Date.now()}`)
    const tmpGz = path.join(os.tmpdir(), `chenaikit-restore-gz-${Date.now()}.gz`)
    const tmpRaw = path.join(os.tmpdir(), `chenaikit-restore-raw-${Date.now()}.db`)

    try {
      // Step 1: fetch the file (from S3 or local disk)
      if (isS3Key) {
        if (!backupConfig.s3Bucket || !backupConfig.awsAccessKeyId) {
          throw new Error('S3_BUCKET and AWS credentials are required to restore from S3')
        }
        logger.info('Downloading backup from S3', { key: s3KeyPath })
        await downloadFromS3({
          destPath: tmpEncOrGz,
          bucket: backupConfig.s3Bucket,
          key: s3KeyPath,
          region: backupConfig.s3Region,
          accessKeyId: backupConfig.awsAccessKeyId,
          secretAccessKey: backupConfig.awsSecretAccessKey,
        })
      } else {
        await fs.promises.copyFile(source, tmpEncOrGz)
      }

      // Step 2: decrypt if the file looks encrypted (filename ends with .enc.gz)
      const sourceName = isS3Key ? source : path.basename(source)
      const needsDecrypt = sourceName.includes('.enc.')
      if (needsDecrypt) {
        if (!this.encrypted) {
          throw new Error('Backup file is encrypted but BACKUP_ENCRYPTION_KEY is not set')
        }
        logger.info('Decrypting backup file')
        await decryptFile(tmpEncOrGz, tmpGz, backupConfig.encryptionKey)
      } else {
        await fs.promises.copyFile(tmpEncOrGz, tmpGz)
      }

      // Step 3: decompress
      logger.info('Decompressing backup file')
      await decompressFile(tmpGz, tmpRaw)

      // Step 4: verify the restored file is a valid SQLite database
      this.verifySqlite(tmpRaw)

      // Step 5: atomically replace the live database
      const tmpDest = `${backupConfig.dbPath}.restore-${Date.now()}`
      await fs.promises.copyFile(tmpRaw, tmpDest)
      await fs.promises.rename(tmpDest, backupConfig.dbPath)
      logger.info('Database restored successfully', { dbPath: backupConfig.dbPath })

      const durationMs = Date.now() - start
      const result: RestoreResult = { restoredFrom: source, durationMs }
      logger.info('Restore completed', result)
      return result
    } finally {
      await fs.promises.rm(tmpEncOrGz, { force: true })
      await fs.promises.rm(tmpGz, { force: true })
      await fs.promises.rm(tmpRaw, { force: true })
    }
  }

  /**
   * List local backup files sorted newest-first.
   */
  async listLocalBackups(): Promise<Array<{ filename: string; sizeBytes: number; createdAt: Date }>> {
    try {
      await fs.promises.mkdir(backupConfig.dir, { recursive: true })
      const files = await fs.promises.readdir(backupConfig.dir)
      const backups = await Promise.all(
        files
          .filter((f) => f.startsWith('backup-') && (f.endsWith('.gz') || f.endsWith('.enc.gz')))
          .map(async (filename) => {
            const stat = await fs.promises.stat(path.join(backupConfig.dir, filename))
            return { filename, sizeBytes: stat.size, createdAt: stat.birthtime }
          }),
      )
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch {
      return []
    }
  }

  /** Remove oldest local backups beyond the retention count. */
  private async pruneLocalBackups(): Promise<void> {
    const backups = await this.listLocalBackups()
    const toDelete = backups.slice(backupConfig.retentionCount)
    for (const { filename } of toDelete) {
      const filePath = path.join(backupConfig.dir, filename)
      await fs.promises.rm(filePath, { force: true })
      logger.info('Pruned old backup', { filename })
    }
  }

  /**
   * Use better-sqlite3's Online Backup API for a live-safe, consistent copy.
   * This copies the database page-by-page without taking an exclusive lock.
   */
  private async sqliteBackup(srcPath: string, destPath: string): Promise<void> {
    const db = new Database(srcPath, { readonly: true })
    try {
      await db.backup(destPath)
    } finally {
      db.close()
    }
  }

  /** Throw if the file at `filePath` is not a valid SQLite database. */
  private verifySqlite(filePath: string): void {
    const db = new Database(filePath, { readonly: true })
    try {
      // SQLite magic header check: first 16 bytes should be "SQLite format 3\000"
      const rows = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>
      const errors = rows.filter((r) => r.integrity_check !== 'ok')
      if (errors.length > 0) {
        throw new Error(`SQLite integrity check failed: ${errors.map((r) => r.integrity_check).join('; ')}`)
      }
    } finally {
      db.close()
    }
  }
}

export const backupService = new BackupService()
