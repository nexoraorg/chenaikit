/**
 * Job monitoring and management routes.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { JobQueue, JobStats, JobInfo } from '../services/jobQueue';
import { QUEUE_NAMES, REDIS_URL } from '../config/jobs';
import { authorize } from '../middleware/auth';

const router = Router();

// Store queue instances (in production, these would be managed by a service)
const queues: Record<string, JobQueue> = {};

// Initialize queues
Object.values(QUEUE_NAMES).forEach((name) => {
  queues[name] = new JobQueue(name, REDIS_URL);
});

/**
 * GET /api/jobs/stats - Get statistics for all queues
 */
router.get('/stats', authorize(['admin']), async (_req: Request, res: Response) => {
  const stats: Record<string, JobStats> = {};
  
  for (const [key, queue] of Object.entries(queues)) {
    stats[key] = await queue.getStats();
  }
  
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/jobs/queues/:queueName/stats - Get statistics for a specific queue
 */
router.get('/queues/:queueName/stats', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName } = req.params;
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  const stats = await queue.getStats();
  
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/jobs/queues/:queueName/jobs - Get jobs from a specific queue
 */
router.get('/queues/:queueName/jobs', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName } = req.params;
  const { state, start, end } = req.query;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  const states = state ? [state as any] : ['waiting', 'active', 'completed', 'failed', 'delayed'];
  const jobs = await queue.getJobs(states, start ? parseInt(start as string) : 0, end ? parseInt(end as string) : -1);
  
  res.json({
    success: true,
    data: jobs,
  });
});

/**
 * GET /api/jobs/queues/:queueName/jobs/:jobId - Get a specific job
 */
router.get('/queues/:queueName/jobs/:jobId', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName, jobId } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { message: `Job ${jobId} not found` },
    });
  }
  
  res.json({
    success: true,
    data: job,
  });
});

/**
 * POST /api/jobs/queues/:queueName/jobs/:jobId/retry - Retry a failed job
 */
router.post('/queues/:queueName/jobs/:jobId/retry', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName, jobId } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  await queue.retryJob(jobId);
  
  res.json({
    success: true,
    message: `Job ${jobId} queued for retry`,
  });
});

/**
 * DELETE /api/jobs/queues/:queueName/jobs/:jobId - Remove a job
 */
router.delete('/queues/:queueName/jobs/:jobId', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName, jobId } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  await queue.removeJob(jobId);
  
  res.json({
    success: true,
    message: `Job ${jobId} removed`,
  });
});

/**
 * POST /api/jobs/queues/:queueName/pause - Pause a queue
 */
router.post('/queues/:queueName/pause', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  await queue.pauseQueue();
  
  res.json({
    success: true,
    message: `Queue ${queueName} paused`,
  });
});

/**
 * POST /api/jobs/queues/:queueName/resume - Resume a paused queue
 */
router.post('/queues/:queueName/resume', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  await queue.resumeQueue();
  
  res.json({
    success: true,
    message: `Queue ${queueName} resumed`,
  });
});

/**
 * GET /api/jobs/dead-letter - Get dead letter queue statistics
 */
router.get('/dead-letter', authorize(['admin']), async (_req: Request, res: Response) => {
  const stats: Record<string, JobStats> = {};
  
  for (const [key, queue] of Object.entries(queues)) {
    stats[key] = await queue.getDeadLetterStats();
  }
  
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/jobs/dead-letter/:queueName - Get dead letter jobs for a queue
 */
router.get('/dead-letter/:queueName', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  const jobs = await queue.getDeadLetterJobs();
  
  res.json({
    success: true,
    data: jobs,
  });
});

/**
 * POST /api/jobs/dead-letter/:queueName/:jobId/retry - Retry a dead letter job
 */
router.post('/dead-letter/:queueName/:jobId/retry', authorize(['admin']), async (req: Request, res: Response) => {
  const { queueName, jobId } = req.params;
  
  const queue = queues[queueName];
  
  if (!queue) {
    return res.status(404).json({
      success: false,
      error: { message: `Queue ${queueName} not found` },
    });
  }
  
  await queue.retryDeadLetterJob(jobId);
  
  res.json({
    success: true,
    message: `Dead letter job ${jobId} queued for retry`,
  });
});

export default router;
