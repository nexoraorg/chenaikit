/**
 * Job configuration for background job processing system.
 */

export interface JobTypeConfig {
  name: string;
  concurrency: number;
  priority: number;
  retries: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  timeout: number;
}

export const JOB_TYPES: Record<string, JobTypeConfig> = {
  email: {
    name: 'email',
    concurrency: 5,
    priority: 5,
    retries: 3,
    backoff: { type: 'exponential', delay: 2000 },
    timeout: 30000,
  },
  report_generation: {
    name: 'report_generation',
    concurrency: 2,
    priority: 3,
    retries: 2,
    backoff: { type: 'exponential', delay: 5000 },
    timeout: 300000,
  },
  data_processing: {
    name: 'data_processing',
    concurrency: 3,
    priority: 4,
    retries: 3,
    backoff: { type: 'exponential', delay: 3000 },
    timeout: 60000,
  },
  cache_warming: {
    name: 'cache_warming',
    concurrency: 2,
    priority: 2,
    retries: 1,
    backoff: { type: 'fixed', delay: 1000 },
    timeout: 120000,
  },
  cleanup: {
    name: 'cleanup',
    concurrency: 1,
    priority: 1,
    retries: 1,
    backoff: { type: 'fixed', delay: 5000 },
    timeout: 600000,
  },
};

export const SCHEDULED_JOBS = [
  {
    name: 'daily-cleanup',
    type: 'cleanup',
    schedule: '0 2 * * *', // 2 AM daily
    data: { task: 'daily_cleanup' },
  },
  {
    name: 'weekly-report',
    type: 'report_generation',
    schedule: '0 9 * * 1', // 9 AM every Monday
    data: { task: 'weekly_report' },
  },
  {
    name: 'cache-warm-hourly',
    type: 'cache_warming',
    schedule: '0 * * * *', // Every hour
    data: { task: 'cache_warm' },
  },
];

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  REPORTS: 'reports-queue',
  DATA_PROCESSING: 'data-processing-queue',
  CACHE: 'cache-queue',
  CLEANUP: 'cleanup-queue',
};

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const JOB_MONITORING = {
  RETENTION_DAYS: 30,
  MAX_LOG_SIZE: 1000,
  ENABLE_METRICS: true,
};
