/**
 * Worker process infrastructure for background job processing.
 */
import { JobQueue } from '../services/jobQueue';
import { QUEUE_NAMES, REDIS_URL, JOB_TYPES, SCHEDULED_JOBS } from '../config/jobs';
import { log } from '../utils/logger';

export interface WorkerConfig {
  queueName: string;
  concurrency: number;
}

export class Worker {
  private queue: JobQueue;
  private config: WorkerConfig;
  private isRunning: boolean = false;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.queue = new JobQueue(config.queueName, REDIS_URL);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn(`Worker for ${this.config.queueName} is already running`);
      return;
    }

    const jobType = JOB_TYPES[this.config.queueName] || JOB_TYPES.data_processing;
    
    this.queue.process(this.config.concurrency, async (job) => {
      log.info(`Processing job ${job.id} in queue ${this.config.queueName}`);
      
      // Route job to appropriate handler based on data
      const { task } = job.data;
      
      switch (task) {
        case 'send_email':
          return await this.handleEmailJob(job);
        case 'generate_report':
          return await this.handleReportJob(job);
        case 'process_data':
          return await this.handleDataProcessingJob(job);
        case 'cache_warm':
          return await this.handleCacheWarmingJob(job);
        case 'daily_cleanup':
        case 'cleanup':
          return await this.handleCleanupJob(job);
        default:
          throw new Error(`Unknown task type: ${task}`);
      }
    });

    this.isRunning = true;
    log.info(`Worker started for queue: ${this.config.queueName}`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await this.queue.close();
    this.isRunning = false;
    log.info(`Worker stopped for queue: ${this.config.queueName}`);
  }

  private async handleEmailJob(job: any): Promise<any> {
    const { to, subject, body } = job.data;
    log.info(`Sending email to ${to}: ${subject}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return { success: true, messageId: `msg-${Date.now()}` };
  }

  private async handleReportJob(job: any): Promise<any> {
    const { reportType, dateRange } = job.data;
    log.info(`Generating ${reportType} report for ${dateRange}`);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true, reportUrl: `/reports/${reportType}-${Date.now()}.pdf` };
  }

  private async handleDataProcessingJob(job: any): Promise<any> {
    const { dataType, records } = job.data;
    log.info(`Processing ${records} ${dataType} records`);
    
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return { success: true, processed: records };
  }

  private async handleCacheWarmingJob(job: any): Promise<any> {
    const { keys } = job.data;
    log.info(`Warming cache for ${keys?.length || 0} keys`);
    
    // Simulate cache warming
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return { success: true, warmedKeys: keys?.length || 0 };
  }

  private async handleCleanupJob(job: any): Promise<any> {
    const { task } = job.data;
    log.info(`Running cleanup task: ${task}`);
    
    // Simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return { success: true, cleanedItems: Math.floor(Math.random() * 100) };
  }
}

/**
 * Worker manager to handle multiple workers
 */
export class WorkerManager {
  private workers: Map<string, Worker> = new Map();

  async startWorker(queueName: string, concurrency?: number): Promise<void> {
    if (this.workers.has(queueName)) {
      log.warn(`Worker for ${queueName} already exists`);
      return;
    }

    const jobType = JOB_TYPES[queueName];
    const workerConcurrency = concurrency || jobType?.concurrency || 3;

    const worker = new Worker({ queueName, concurrency: workerConcurrency });
    await worker.start();
    this.workers.set(queueName, worker);
  }

  async stopWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.stop();
      this.workers.delete(queueName);
    }
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
    await Promise.all(stopPromises);
    this.workers.clear();
  }

  getRunningWorkers(): string[] {
    return Array.from(this.workers.keys());
  }
}

/**
 * Start all configured workers
 */
export async function startAllWorkers(): Promise<WorkerManager> {
  const manager = new WorkerManager();

  for (const queueName of Object.values(QUEUE_NAMES)) {
    await manager.startWorker(queueName);
  }

  log.info('All workers started');
  return manager;
}

/**
 * Setup scheduled jobs
 */
export async function setupScheduledJobs(queue: JobQueue): Promise<void> {
  for (const scheduledJob of SCHEDULED_JOBS) {
    const queueName = QUEUE_NAMES[scheduledJob.type.toUpperCase() as keyof typeof QUEUE_NAMES];
    if (queueName) {
      await queue.add(scheduledJob.data, {
        repeat: { cron: scheduledJob.schedule },
        jobId: scheduledJob.name,
      });
      log.info(`Scheduled job ${scheduledJob.name} with cron ${scheduledJob.schedule}`);
    }
  }
}
