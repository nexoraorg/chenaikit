import Queue from 'bull';
import { getEmailConfig } from '../config/email';
import { getEmailService, type SendEmailOptions } from '../services/emailService';
import { log } from '../utils/logger';

export type EmailJobData = SendEmailOptions & { _jobId?: string };

let emailQueue: Queue.Queue<EmailJobData> | null = null;

function getQueue(): Queue.Queue<EmailJobData> {
  if (emailQueue) return emailQueue;

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const cfg = getEmailConfig();

  emailQueue = new Queue<EmailJobData>('email', redisUrl, {
    defaultJobOptions: {
      attempts: cfg.queue.maxAttempts,
      backoff: { type: 'exponential', delay: cfg.queue.backoffDelayMs },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  emailQueue.process(cfg.queue.concurrency, async (job) => {
    const service = getEmailService();
    const result = await service.send(job.data);
    log.info('[email-queue] job completed', { jobId: job.id, messageId: result.messageId });
    return result;
  });

  emailQueue.on('failed', (job, err) => {
    log.error('[email-queue] job failed', err, { jobId: job.id, to: job.data.to });
  });

  emailQueue.on('stalled', (job) => {
    log.warn('[email-queue] job stalled', { jobId: job.id });
  });

  return emailQueue;
}

/**
 * Enqueue an email to be sent asynchronously via the Bull job queue.
 */
export async function enqueueEmail(options: SendEmailOptions): Promise<Queue.Job<EmailJobData>> {
  const queue = getQueue();
  const job = await queue.add(options);
  log.info('[email-queue] enqueued', { jobId: job.id, to: options.to, subject: options.subject });
  return job;
}

/**
 * Drain and close the email queue (for graceful shutdown).
 */
export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
    log.info('[email-queue] closed');
  }
}

export { getQueue as getEmailQueue };
