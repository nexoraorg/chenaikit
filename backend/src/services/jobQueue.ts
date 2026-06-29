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
  priority?: number;
  delay?: number;
  repeat?: {
    every?: number;
    cron?: string;
  };
  jobId?: string;
}

export interface JobStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface JobInfo {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: any;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  processedOn?: number;
  finishedOn?: number;
  delay?: number;
  timestamp?: number;
}

export class JobQueue {
  private queue: Queue.Queue;
  private deadLetterQueue: Queue.Queue;
  private name: string;

  constructor(name: string, redisUrl: string) {
    this.name = name;
    this.queue = new Queue(name, redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
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

    this.queue.on('completed', (job, result) => {
      // eslint-disable-next-line no-console
      console.log(`Job ${job.id} completed:`, result);
    });
  }

  async add(data: any, config?: JobConfig): Promise<Queue.Job> {
    return this.queue.add(data, config);
  }

  async addBulk(jobs: Array<{ name: string; data: any; opts?: JobConfig }>): Promise<Queue.Job[]> {
    return this.queue.addBulk(jobs);
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

  async getStats(): Promise<JobStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount(),
    ]);

    return { waiting, active, completed, failed, delayed, paused };
  }

  async getJobs(states: Queue.JobStatus[] = ['waiting', 'active', 'completed', 'failed', 'delayed'], start?: number, end?: number): Promise<JobInfo[]> {
    const jobs = await this.queue.getJobs(states, start, end);
    return jobs.map(job => ({
      id: job.id!.toString(),
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts.delay,
      timestamp: job.timestamp,
    }));
  }

  async getJob(jobId: string): Promise<JobInfo | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    
    return {
      id: job.id!.toString(),
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts.delay,
      timestamp: job.timestamp,
    };
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }

  async isPaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  async obliterate(opts?: { force: boolean }): Promise<void> {
    await this.queue.obliterate(opts);
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

  async getDeadLetterStats(): Promise<JobStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.deadLetterQueue.getWaitingCount(),
      this.deadLetterQueue.getActiveCount(),
      this.deadLetterQueue.getCompletedCount(),
      this.deadLetterQueue.getFailedCount(),
      this.deadLetterQueue.getDelayedCount(),
      this.deadLetterQueue.getPausedCount(),
    ]);

    return { waiting, active, completed, failed, delayed, paused };
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.deadLetterQueue.close();
  }

  getName(): string {
    return this.name;
  }
}
