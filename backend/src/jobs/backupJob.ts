import Queue from 'bull'
import { backupService } from '../services/backupService'
import { backupConfig } from '../config/backup'
import { logger } from '../utils/logger'

const QUEUE_NAME = 'database-backup'

let backupQueue: Queue.Queue | null = null

/**
 * Initialise the backup job queue and register the recurring schedule.
 *
 * Call once at application startup when Redis is available.
 */
export function initBackupScheduler(redisUrl: string): void {
  backupQueue = new Queue(QUEUE_NAME, redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  })

  // Register the cron-style repeating backup job
  backupQueue.add(
    { type: 'scheduled' },
    {
      repeat: { cron: backupConfig.schedule },
      jobId: 'backup-scheduled',
    },
  )

  backupQueue.process(1, async (job) => {
    logger.info('Running scheduled database backup', { jobId: job.id })
    try {
      const result = await backupService.createBackup()
      logger.info('Scheduled backup completed', {
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        uploadedToS3: result.uploadedToS3,
        durationMs: result.durationMs,
      })
      return result
    } catch (err) {
      logger.error('Scheduled backup failed', { error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  })

  backupQueue.on('failed', (job, err) => {
    logger.error('Backup job failed', { jobId: job.id, error: err.message, attempts: job.attemptsMade })
  })

  logger.info('Backup scheduler initialised', { schedule: backupConfig.schedule })
}

/**
 * Enqueue an immediate (manual) backup job.
 */
export async function triggerManualBackup(): Promise<string> {
  if (!backupQueue) throw new Error('Backup scheduler is not initialised')
  const job = await backupQueue.add({ type: 'manual' }, { removeOnComplete: true })
  logger.info('Manual backup job enqueued', { jobId: job.id })
  return String(job.id)
}

export async function closeBackupScheduler(): Promise<void> {
  if (backupQueue) {
    await backupQueue.close()
    backupQueue = null
  }
}
