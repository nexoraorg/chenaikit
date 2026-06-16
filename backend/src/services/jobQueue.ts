import Queue from 'bull';
import { captureError } from '../middleware/errorTracking';

export interface JobConfig {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export class JobQueue {
  private queue: Queue.Queue;
  private deadLetterQueue: Queue.Queue;

  constructor(name: string, redisUrl: string) {
    this.queue = new Queue(name, redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    this.deadLetterQueue = new Queue(`${name}-dlq`, redisUrl);

    this.queue.on('failed', async (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`Job ${job.id} failed:`, err);
      captureError(err, { jobId: job.id, jobData: job.data });

      if (job.attemptsMade >= job.opts.attempts!) {
        await this.deadLetterQueue.add(job.data, {
          jobId: `dlq-${job.id}`,
          removeOnComplete: false
        });
      }
    });
  }

  async add(data: any, config?: JobConfig): Promise<Queue.Job> {
    return this.queue.add(data, config);
  }

  process(concurrency: number, handler: (job: Queue.Job) => Promise<any>): void {
    this.queue.process(concurrency, async (job) => {
      try {
        return await handler(job);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Processing error for job ${job.id}:`, error);
        throw error;
      }
    });
  }

  async retryDeadLetterJob(jobId: string): Promise<void> {
    const job = await this.deadLetterQueue.getJob(jobId);
    if (job) {
      await this.queue.add(job.data);
      await job.remove();
    }
  }

  async getDeadLetterJobs(): Promise<Queue.Job[]> {
    return this.deadLetterQueue.getJobs(['completed', 'waiting', 'active', 'delayed', 'failed']);
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.deadLetterQueue.close();
  }
}
