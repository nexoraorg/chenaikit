import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { log } from '../utils/logger';
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import {
  Webhook,
  WebhookDelivery,
  WebhookCreateInput,
  WebhookUpdateInput,
  WebhookEventPayload,
  WebhookEventType,
  WebhookDeliveryStatus,
  WEBHOOK_EVENT_TYPES,
} from '../models/Webhook';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  signPayload,
  buildEventPayload,
  nextRetryAt,
  isValidWebhookUrl,
} from '../utils/webhookUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  successRate: number;
  averageDurationMs: number;
  deliveriesByEvent: Record<string, number>;
  recentFailures: Array<{
    deliveryId: string;
    eventType: string;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Register a new webhook endpoint for a user.
   */
  async createWebhook(
    input: WebhookCreateInput
  ): Promise<{ webhook: Webhook; plainSecret: string }> {
    this.validateEvents(input.events);

    if (!isValidWebhookUrl(input.url)) {
      throw new ValidationError(
        'Webhook URL must be a valid HTTPS URL',
        { url: input.url }
      );
    }

    const plainSecret = generateWebhookSecret();
    const secretHash = hashWebhookSecret(plainSecret);

    try {
      const record = await this.prisma.webhook.create({
        data: {
          userId: input.userId,
          name: input.name,
          url: input.url,
          secret: plainSecret,     // stored once; callers must persist it
          secretHash,
          events: JSON.stringify(input.events),
          isActive: true,
          isPaused: false,
          allowedIps: JSON.stringify(input.allowedIps ?? []),
          headers: JSON.stringify(input.headers ?? {}),
          maxRetries: input.maxRetries ?? 3,
          timeoutMs: input.timeoutMs ?? 10_000,
        },
      });

      const webhook = Webhook.fromPrisma(record);

      log.info('Webhook created', {
        webhookId: webhook.id,
        userId: webhook.userId,
        url: webhook.url,
        events: webhook.events,
      });

      return { webhook, plainSecret };
    } catch (error: any) {
      throw new DatabaseError('Failed to create webhook', { cause: error.message });
    }
  }

  /**
   * Retrieve a single webhook by ID, scoped to the owning user.
   */
  async getWebhook(webhookId: string, userId: string): Promise<Webhook> {
    const record = await this.prisma.webhook.findFirst({
      where: { id: webhookId, userId, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundError('Webhook not found', { webhookId });
    }

    return Webhook.fromPrisma(record);
  }

  /**
   * List all webhooks belonging to a user (soft-deleted records excluded).
   */
  async listWebhooks(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ webhooks: Webhook[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.webhook.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhook.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      webhooks: records.map(Webhook.fromPrisma),
      total,
      page,
      limit,
    };
  }

  /**
   * Update a webhook's configuration.
   */
  async updateWebhook(
    webhookId: string,
    userId: string,
    input: WebhookUpdateInput
  ): Promise<Webhook> {
    await this.getWebhook(webhookId, userId); // ownership check

    if (input.events) this.validateEvents(input.events);
    if (input.url && !isValidWebhookUrl(input.url)) {
      throw new ValidationError('Webhook URL must be a valid HTTPS URL', { url: input.url });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined)      updateData.name       = input.name;
    if (input.url !== undefined)       updateData.url        = input.url;
    if (input.events !== undefined)    updateData.events     = JSON.stringify(input.events);
    if (input.isActive !== undefined)  updateData.isActive   = input.isActive;
    if (input.isPaused !== undefined)  updateData.isPaused   = input.isPaused;
    if (input.allowedIps !== undefined) updateData.allowedIps = JSON.stringify(input.allowedIps);
    if (input.headers !== undefined)   updateData.headers    = JSON.stringify(input.headers);
    if (input.maxRetries !== undefined) updateData.maxRetries = input.maxRetries;
    if (input.timeoutMs !== undefined) updateData.timeoutMs  = input.timeoutMs;

    try {
      const record = await this.prisma.webhook.update({
        where: { id: webhookId },
        data: updateData as any,
      });

      log.info('Webhook updated', { webhookId, userId, fields: Object.keys(updateData) });
      return Webhook.fromPrisma(record);
    } catch (error: any) {
      throw new DatabaseError('Failed to update webhook', { cause: error.message });
    }
  }

  /**
   * Soft-delete a webhook.
   */
  async deleteWebhook(webhookId: string, userId: string): Promise<void> {
    await this.getWebhook(webhookId, userId); // ownership check

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { deletedAt: new Date(), isActive: false },
    });

    log.info('Webhook deleted', { webhookId, userId });
  }

  /**
   * Pause or resume a webhook without deleting it.
   */
  async setPaused(webhookId: string, userId: string, paused: boolean): Promise<Webhook> {
    return this.updateWebhook(webhookId, userId, { isPaused: paused });
  }

  /**
   * Rotate the signing secret of a webhook.  Returns the new plain-text secret.
   */
  async rotateSecret(webhookId: string, userId: string): Promise<string> {
    await this.getWebhook(webhookId, userId); // ownership check

    const plainSecret = generateWebhookSecret();
    const secretHash = hashWebhookSecret(plainSecret);

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret: plainSecret, secretHash },
    });

    log.info('Webhook secret rotated', { webhookId, userId });
    return plainSecret;
  }

  // -------------------------------------------------------------------------
  // Event dispatching
  // -------------------------------------------------------------------------

  /**
   * Dispatches an event to all active, non-paused webhooks that subscribe to
   * the given event type.  Delivery is attempted immediately; failures are
   * scheduled for retry via `scheduleRetry`.
   *
   * Returns an array of delivery results (one per matching webhook).
   */
  async dispatch(
    eventType: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<WebhookDelivery[]> {
    const payload = buildEventPayload(eventType, data);

    // Find all eligible webhooks
    const records = await this.prisma.webhook.findMany({
      where: { isActive: true, isPaused: false, deletedAt: null },
    });

    const eligible = records
      .map(Webhook.fromPrisma)
      .filter((w: Webhook) => w.isSubscribedTo(eventType));

    if (eligible.length === 0) {
      log.debug('No webhooks subscribed to event', { eventType });
      return [];
    }

    // Deliver in parallel (fire-and-forget errors handled per-delivery)
    const deliveries = await Promise.all(
      eligible.map((webhook: Webhook) => this.deliver(webhook, payload))
    );

    return deliveries;
  }

  /**
   * Send a test event to a specific webhook (bypasses active/paused checks).
   */
  async sendTestEvent(webhookId: string, userId: string): Promise<WebhookDelivery> {
    const webhook = await this.getWebhook(webhookId, userId);

    const payload = buildEventPayload('system.webhook_test', {
      message: 'This is a test webhook delivery from ChenAIKit.',
      webhookId,
    });

    return this.deliver(webhook, payload);
  }

  // -------------------------------------------------------------------------
  // Delivery
  // -------------------------------------------------------------------------

  /**
   * Creates a delivery record and attempts to POST to the webhook URL.
   */
  private async deliver(
    webhook: Webhook,
    payload: WebhookEventPayload
  ): Promise<WebhookDelivery> {
    const payloadJson = JSON.stringify(payload);
    const signature = signPayload(payloadJson, webhook.secret);

    // Create a pending delivery record
    let deliveryRecord = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: payload.type,
        eventId: payload.id,
        payload: payloadJson,
        status: 'pending',
        attempt: 1,
        maxAttempts: webhook.maxRetries + 1,
      },
    });

    const startTime = Date.now();

    try {
      const response = await this.postToUrl(
        webhook.url,
        payloadJson,
        signature,
        webhook.headers,
        webhook.timeoutMs
      );

      const duration = Date.now() - startTime;
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const status: WebhookDeliveryStatus = isSuccess ? 'success' : 'failed';

      deliveryRecord = await this.prisma.webhookDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          statusCode: response.statusCode,
          responseBody: response.body.slice(0, 4096), // cap stored body
          responseHeaders: JSON.stringify(response.headers),
          status,
          duration,
          deliveredAt: isSuccess ? new Date() : undefined,
          errorMessage: isSuccess ? null : `HTTP ${response.statusCode}`,
          nextRetryAt:
            !isSuccess && deliveryRecord.attempt < deliveryRecord.maxAttempts
              ? nextRetryAt(deliveryRecord.attempt)
              : undefined,
        },
      });

      // Update lastTriggeredAt on webhook
      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() },
      });

      log.info('Webhook delivered', {
        webhookId: webhook.id,
        deliveryId: deliveryRecord.id,
        eventType: payload.type,
        statusCode: response.statusCode,
        duration,
        status,
      });

      // Schedule retry if delivery failed and retries remain
      if (!isSuccess && deliveryRecord.attempt < deliveryRecord.maxAttempts) {
        this.scheduleRetry(deliveryRecord.id, webhook, payload, deliveryRecord.attempt);
      }

      return WebhookDelivery.fromPrisma(deliveryRecord);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      deliveryRecord = await this.prisma.webhookDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          status: 'failed',
          errorMessage: error.message ?? 'Unknown error',
          duration,
          nextRetryAt:
            deliveryRecord.attempt < deliveryRecord.maxAttempts
              ? nextRetryAt(deliveryRecord.attempt)
              : undefined,
        },
      });

      log.warn('Webhook delivery failed', {
        webhookId: webhook.id,
        deliveryId: deliveryRecord.id,
        eventType: payload.type,
        error: error.message,
        attempt: deliveryRecord.attempt,
      });

      if (deliveryRecord.attempt < deliveryRecord.maxAttempts) {
        this.scheduleRetry(deliveryRecord.id, webhook, payload, deliveryRecord.attempt);
      }

      return WebhookDelivery.fromPrisma(deliveryRecord);
    }
  }

  /**
   * Schedules a retry using exponential backoff via setTimeout.
   * In a production setup this would be replaced by a Bull queue job.
   */
  protected scheduleRetry(
    deliveryId: string,
    webhook: Webhook,
    payload: WebhookEventPayload,
    currentAttempt: number
  ): void {
    const { calculateRetryDelay } = require('../utils/webhookUtils') as typeof import('../utils/webhookUtils');
    const delayMs = calculateRetryDelay(currentAttempt);

    log.debug('Scheduling webhook retry', {
      deliveryId,
      webhookId: webhook.id,
      nextAttempt: currentAttempt + 1,
      delayMs,
    });

    setTimeout(async () => {
      try {
        await this.retryDelivery(deliveryId, webhook, payload, currentAttempt + 1);
      } catch (err: any) {
        log.error('Webhook retry scheduling error', { deliveryId, error: err.message });
      }
    }, delayMs);
  }

  /**
   * Executes a single retry attempt for an existing delivery record.
   * Marked `protected` so the retry worker can invoke it without needing
   * full access to the delivery internals.
   */
  protected async retryDelivery(
    deliveryId: string,
    webhook: Webhook,
    payload: WebhookEventPayload,
    attempt: number
  ): Promise<void> {
    // Re-fetch to make sure the webhook is still active
    const freshRecord = await this.prisma.webhook.findFirst({
      where: { id: webhook.id, isActive: true, isPaused: false, deletedAt: null },
    });

    if (!freshRecord) {
      log.info('Skipping retry – webhook no longer active', { webhookId: webhook.id, deliveryId });
      return;
    }

    const freshWebhook = Webhook.fromPrisma(freshRecord);
    const payloadJson = JSON.stringify(payload);
    const signature = signPayload(payloadJson, freshWebhook.secret);
    const startTime = Date.now();

    // Mark as retrying
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'retrying', attempt },
    });

    try {
      const response = await this.postToUrl(
        freshWebhook.url,
        payloadJson,
        signature,
        freshWebhook.headers,
        freshWebhook.timeoutMs
      );

      const duration = Date.now() - startTime;
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const maxAttempts = freshWebhook.maxRetries + 1;

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          statusCode: response.statusCode,
          responseBody: response.body.slice(0, 4096),
          responseHeaders: JSON.stringify(response.headers),
          status: isSuccess ? 'success' : attempt >= maxAttempts ? 'failed' : 'retrying',
          duration,
          deliveredAt: isSuccess ? new Date() : undefined,
          errorMessage: isSuccess ? null : `HTTP ${response.statusCode}`,
          nextRetryAt:
            !isSuccess && attempt < maxAttempts ? nextRetryAt(attempt) : undefined,
        },
      });

      if (!isSuccess && attempt < maxAttempts) {
        this.scheduleRetry(deliveryId, freshWebhook, payload, attempt);
      }

      log.info('Webhook retry result', {
        deliveryId,
        webhookId: webhook.id,
        attempt,
        statusCode: response.statusCode,
        duration,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const maxAttempts = freshWebhook.maxRetries + 1;

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: attempt >= maxAttempts ? 'failed' : 'retrying',
          errorMessage: error.message ?? 'Unknown error',
          duration,
          nextRetryAt: attempt < maxAttempts ? nextRetryAt(attempt) : undefined,
        },
      });

      if (attempt < maxAttempts) {
        this.scheduleRetry(deliveryId, freshWebhook, payload, attempt);
      }

      log.warn('Webhook retry failed', {
        deliveryId,
        webhookId: webhook.id,
        attempt,
        error: error.message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // HTTP helper
  // -------------------------------------------------------------------------

  private postToUrl(
    url: string,
    body: string,
    signature: string,
    customHeaders: Record<string, string>,
    timeoutMs: number
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': Date.now().toString(),
        'User-Agent': 'ChenAIKit-Webhooks/1.0',
        ...customHeaders,
      };

      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers,
        timeout: timeoutMs,
      };

      const req = transport.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: responseBody,
            headers: res.headers as Record<string, string>,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Webhook request timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => reject(err));

      req.write(body);
      req.end();
    });
  }

  // -------------------------------------------------------------------------
  // Recovery (used by WebhookRetryWorker)
  // -------------------------------------------------------------------------

  /**
   * Public entry point for the retry worker to re-attempt a stuck delivery.
   * Looks up the full delivery + webhook from the DB and kicks off a retry.
   */
  async recoverDelivery(deliveryId: string): Promise<void> {
    const record = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!record || !record.webhook) {
      log.warn('recoverDelivery: delivery not found', { deliveryId });
      return;
    }

    if (!record.webhook.isActive || record.webhook.isPaused || record.webhook.deletedAt) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', errorMessage: 'Webhook was deactivated or deleted' },
      });
      return;
    }

    if (record.attempt >= record.maxAttempts) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', errorMessage: 'Max retry attempts reached' },
      });
      return;
    }

    const webhook = Webhook.fromPrisma(record.webhook);
    const payload = JSON.parse(record.payload) as WebhookEventPayload;

    await this.retryDelivery(deliveryId, webhook, payload, record.attempt + 1);
  }

  // -------------------------------------------------------------------------
  // Delivery history & monitoring
  // -------------------------------------------------------------------------

  /**
   * Returns the delivery history for a webhook.
   */
  async getDeliveries(
    webhookId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: WebhookDeliveryStatus;
    } = {}
  ): Promise<{ deliveries: WebhookDelivery[]; total: number; page: number; limit: number }> {
    await this.getWebhook(webhookId, userId); // ownership check

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { webhookId };
    if (options.status) where.status = options.status;

    const [records, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      deliveries: records.map(WebhookDelivery.fromPrisma),
      total,
      page,
      limit,
    };
  }

  /**
   * Returns aggregated delivery statistics for a webhook.
   */
  async getStats(webhookId: string, userId: string): Promise<WebhookStats> {
    await this.getWebhook(webhookId, userId); // ownership check

    const [total, successful, failed, pending, avgDuration, byEvent, recentFailures] =
      await Promise.all([
        this.prisma.webhookDelivery.count({ where: { webhookId } }),
        this.prisma.webhookDelivery.count({ where: { webhookId, status: 'success' } }),
        this.prisma.webhookDelivery.count({ where: { webhookId, status: 'failed' } }),
        this.prisma.webhookDelivery.count({
          where: { webhookId, status: { in: ['pending', 'retrying'] } },
        }),
        this.prisma.webhookDelivery.aggregate({
          where: { webhookId, status: 'success' },
          _avg: { duration: true },
        }),
        this.prisma.webhookDelivery.groupBy({
          by: ['eventType'],
          where: { webhookId },
          _count: true,
        }),
        this.prisma.webhookDelivery.findMany({
          where: { webhookId, status: 'failed' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            eventType: true,
            errorMessage: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      totalDeliveries: total,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      pendingDeliveries: pending,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDurationMs: avgDuration._avg.duration ?? 0,
      deliveriesByEvent: (byEvent as Array<{ eventType: string; _count: number }>)
        .reduce<Record<string, number>>((acc, item) => {
          acc[item.eventType] = item._count;
          return acc;
        }, {}),
      recentFailures: recentFailures.map((d: { id: string; eventType: string; errorMessage: string | null; createdAt: Date }) => ({
        deliveryId: d.id,
        eventType: d.eventType,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private validateEvents(events: WebhookEventType[]): void {
    if (!events || events.length === 0) {
      throw new ValidationError('At least one event type must be specified');
    }

    const invalid = events.filter((e) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
    if (invalid.length > 0) {
      throw new ValidationError('Invalid event types', { invalid });
    }
  }
}
