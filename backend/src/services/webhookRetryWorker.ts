/**
 * WebhookRetryWorker
 *
 * On startup, this worker queries the database for any deliveries that were
 * in a `retrying` or `pending` state when the process last shut down and
 * requeues them.  This ensures no webhook events are silently lost across
 * server restarts.
 *
 * It also polls on a regular interval to recover deliveries whose
 * `nextRetryAt` has elapsed (e.g., when the in-process setTimeout was lost
 * due to a crash or deploy).
 *
 * Usage — call `startWebhookRetryWorker(service, prisma)` once in index.ts
 * after the server starts listening.
 */

import type { PrismaClient } from '@prisma/client';
import type { WebhookService } from './webhookService';
import { log } from '../utils/logger';

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds
const BATCH_SIZE = 100;

export function startWebhookRetryWorker(
  service: WebhookService,
  prisma: PrismaClient
): ReturnType<typeof setInterval> {
  // Run immediately on startup to recover stuck deliveries
  void recoverStuckDeliveries(service, prisma);

  // Then poll on an interval
  const timer = setInterval(
    () => void recoverStuckDeliveries(service, prisma),
    POLL_INTERVAL_MS
  );

  // Don't prevent the process from exiting cleanly
  timer.unref();

  log.info('WebhookRetryWorker started', { pollIntervalMs: POLL_INTERVAL_MS });
  return timer;
}

/**
 * Finds deliveries past their `nextRetryAt` timestamp and re-dispatches them
 * via `WebhookService.recoverDelivery`.
 */
async function recoverStuckDeliveries(
  service: WebhookService,
  prisma: PrismaClient
): Promise<void> {
  try {
    const now = new Date();

    const stuck = await prisma.webhookDelivery.findMany({
      where: {
        status: { in: ['pending', 'retrying'] },
        nextRetryAt: { lte: now },
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { nextRetryAt: 'asc' },
    });

    if (stuck.length === 0) return;

    log.info('WebhookRetryWorker recovering stuck deliveries', { count: stuck.length });

    const results = await Promise.allSettled(
      stuck.map((d: { id: string }) => service.recoverDelivery(d.id))
    );

    const failed = results.filter((r: PromiseSettledResult<void>) => r.status === 'rejected');
    if (failed.length > 0) {
      log.warn('WebhookRetryWorker: some recoveries failed', {
        total: stuck.length,
        failedCount: failed.length,
      });
    }
  } catch (err: any) {
    log.error('WebhookRetryWorker error during recovery', err);
  }
}
