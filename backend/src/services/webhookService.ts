import { PrismaClient } from '@prisma/client';
import { Webhook, WebhookCreateInput, WebhookUpdateInput, WebhookDelivery } from '../models/Webhook';
import { WebhookEventType, generateSignature, calculateNextRetry, safeJsonParse, isValidWebhookUrl, formatWebhookPayload, DEFAULT_RETRY_CONFIG } from '../utils/webhookUtils';
import { log } from '../utils/logger';
import { randomBytes } from 'crypto';
import { NotFoundError, ValidationError } from '../utils/errors';

export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a secure webhook secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new webhook
   */
  async createWebhook(input: WebhookCreateInput): Promise<{ webhook: Webhook; secret: string }> {
    if (!isValidWebhookUrl(input.url)) {
      throw new ValidationError('Invalid webhook URL');
    }

    const secret = this.generateSecret();
    const retryConfig = {
      maxAttempts: input.retryConfig?.maxAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
      initialDelay: input.retryConfig?.initialDelay || DEFAULT_RETRY_CONFIG.initialDelay,
      maxDelay: input.retryConfig?.maxDelay || DEFAULT_RETRY_CONFIG.maxDelay,
      backoffMultiplier: input.retryConfig?.backoffMultiplier || DEFAULT_RETRY_CONFIG.backoffMultiplier,
    };

    const prismaWebhook = await this.prisma.webhook.create({
      data: {
        userId: input.userId,
        url: input.url,
        secret,
        eventTypes: JSON.stringify(input.eventTypes),
        isActive: true,
        isPaused: false,
        allowedIps: JSON.stringify(input.allowedIps || []),
        headers: JSON.stringify(input.headers || {}),
        retryConfig: JSON.stringify(retryConfig),
      },
    });

    const webhook = Webhook.fromPrisma(prismaWebhook);

    log.info('Webhook created', {
      webhookId: webhook.id,
      userId: webhook.userId,
      url: webhook.url,
      eventTypes: webhook.eventTypes,
    });

    return { webhook, secret };
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<Webhook | null> {
    const prismaWebhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    return prismaWebhook ? Webhook.fromPrisma(prismaWebhook) : null;
  }

  /**
   * Get all webhooks for a user
   */
  async getWebhooksByUserId(userId: string): Promise<Webhook[]> {
    const prismaWebhooks = await this.prisma.webhook.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return prismaWebhooks.map(Webhook.fromPrisma);
  }

  /**
   * Get webhooks eligible for a specific event type
   */
  async getWebhooksForEvent(eventType: WebhookEventType): Promise<Webhook[]> {
    const prismaWebhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        isPaused: false,
        deletedAt: null,
      },
    });

    return prismaWebhooks
      .map(Webhook.fromPrisma)
      .filter(webhook => webhook.isEligibleForEvent(eventType));
  }

  /**
   * Update a webhook
   */
  async updateWebhook(id: string, input: WebhookUpdateInput): Promise<Webhook> {
    const existingWebhook = await this.getWebhookById(id);
    if (!existingWebhook) {
      throw new NotFoundError('Webhook not found');
    }

    if (input.url && !isValidWebhookUrl(input.url)) {
      throw new ValidationError('Invalid webhook URL');
    }

    const updateData: any = {};
    if (input.url !== undefined) updateData.url = input.url;
    if (input.secret !== undefined) updateData.secret = input.secret;
    if (input.eventTypes !== undefined) updateData.eventTypes = JSON.stringify(input.eventTypes);
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.isPaused !== undefined) updateData.isPaused = input.isPaused;
    if (input.allowedIps !== undefined) updateData.allowedIps = JSON.stringify(input.allowedIps);
    if (input.headers !== undefined) updateData.headers = JSON.stringify(input.headers);
    if (input.retryConfig !== undefined) {
      updateData.retryConfig = JSON.stringify({
        maxAttempts: input.retryConfig.maxAttempts || existingWebhook.retryConfig.maxAttempts,
        initialDelay: input.retryConfig.initialDelay || existingWebhook.retryConfig.initialDelay,
        maxDelay: input.retryConfig.maxDelay || existingWebhook.retryConfig.maxDelay,
        backoffMultiplier: input.retryConfig.backoffMultiplier || existingWebhook.retryConfig.backoffMultiplier,
      });
    }

    const prismaWebhook = await this.prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    const webhook = Webhook.fromPrisma(prismaWebhook);

    log.info('Webhook updated', {
      webhookId: webhook.id,
      userId: webhook.userId,
    });

    return webhook;
  }

  /**
   * Delete a webhook (soft delete)
   */
  async deleteWebhook(id: string): Promise<void> {
    await this.prisma.webhook.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    log.info('Webhook soft-deleted', { webhookId: id });
  }

  /**
   * Pause a webhook
   */
  async pauseWebhook(id: string): Promise<Webhook> {
    return this.updateWebhook(id, { isPaused: true });
  }

  /**
   * Resume a webhook
   */
  async resumeWebhook(id: string): Promise<Webhook> {
    return this.updateWebhook(id, { isPaused: false });
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(id: string): Promise<string> {
    const newSecret = this.generateSecret();
    await this.prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });

    log.info('Webhook secret regenerated', { webhookId: id });

    return newSecret;
  }

  /**
   * Trigger webhook delivery
   */
  async triggerWebhook(webhook: Webhook, eventType: WebhookEventType, data: unknown): Promise<WebhookDelivery> {
    const payload = formatWebhookPayload(eventType, data);
    const signature = generateSignature(payload, webhook.secret);

    const prismaDelivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType,
        payload,
        attemptCount: 0,
      },
    });

    const delivery = WebhookDelivery.fromPrisma(prismaDelivery);

    // Attempt delivery asynchronously
    this.deliverWebhook(webhook, delivery, signature).catch(error => {
      log.error('Webhook delivery failed', {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        error: error as Error,
      });
    });

    return delivery;
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: Webhook,
    delivery: WebhookDelivery,
    signature: string
  ): Promise<void> {
    const maxAttempts = webhook.retryConfig.maxAttempts;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': delivery.eventType,
          ...webhook.headers,
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: delivery.payload,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        const responseStatus = response.status;
        const responseBody = await response.text();

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            responseStatus,
            responseBody,
            attemptCount: attempt + 1,
            succeededAt: responseStatus >= 200 && responseStatus < 300 ? new Date() : undefined,
            failedAt: responseStatus >= 400 || responseStatus < 200 ? new Date() : undefined,
            nextRetryAt: responseStatus >= 400 && responseStatus < 500 && attempt < maxAttempts - 1
              ? calculateNextRetry(attempt)
              : undefined,
          },
        });

        if (responseStatus >= 200 && responseStatus < 300) {
          log.info('Webhook delivered successfully', {
            deliveryId: delivery.id,
            webhookId: webhook.id,
            attempt: attempt + 1,
            responseStatus,
          });
          return;
        }

        log.warn('Webhook delivery failed', {
          deliveryId: delivery.id,
          webhookId: webhook.id,
          attempt: attempt + 1,
          responseStatus,
        });

        // If it's a client error (4xx), don't retry
        if (responseStatus >= 400 && responseStatus < 500) {
          return;
        }

        // Wait before retrying
        if (attempt < maxAttempts - 1) {
          const nextRetry = calculateNextRetry(attempt);
          const delay = nextRetry.getTime() - Date.now();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        log.error('Webhook delivery error', {
          deliveryId: delivery.id,
          webhookId: webhook.id,
          attempt: attempt + 1,
          error: error as Error,
        });

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attemptCount: attempt + 1,
            nextRetryAt: attempt < maxAttempts - 1 ? calculateNextRetry(attempt) : undefined,
          },
        });

        if (attempt < maxAttempts - 1) {
          const nextRetry = calculateNextRetry(attempt);
          const delay = nextRetry.getTime() - Date.now();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    log.error('Webhook delivery failed after all retries', {
      deliveryId: delivery.id,
      webhookId: webhook.id,
    });
  }

  /**
   * Get webhook delivery by ID
   */
  async getDeliveryById(id: string): Promise<WebhookDelivery | null> {
    const prismaDelivery = await this.prisma.webhookDelivery.findUnique({
      where: { id },
    });

    return prismaDelivery ? WebhookDelivery.fromPrisma(prismaDelivery) : null;
  }

  /**
   * Get deliveries for a webhook
   */
  async getDeliveriesByWebhookId(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    const prismaDeliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return prismaDeliveries.map(WebhookDelivery.fromPrisma);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    averageResponseTime?: number;
    successRate: number;
  }> {
    const deliveries = await this.getDeliveriesByWebhookId(webhookId, 1000);

    const successful = deliveries.filter(d => d.isSuccessful()).length;
    const failed = deliveries.filter(d => d.failedAt && !d.succeededAt).length;
    const pending = deliveries.filter(d => !d.succeededAt && !d.failedAt).length;

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      pendingDeliveries: pending,
      successRate: deliveries.length > 0 ? (successful / deliveries.length) * 100 : 0,
    };
  }

  /**
   * Test a webhook by sending a test event
   */
  async testWebhook(id: string): Promise<WebhookDelivery> {
    const webhook = await this.getWebhookById(id);
    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    return this.triggerWebhook(webhook, WebhookEventType.SYSTEM_ERROR, {
      test: true,
      message: 'Test webhook delivery',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Process failed webhook deliveries for retry
   */
  async processRetryQueue(): Promise<number> {
    const pendingDeliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        nextRetryAt: {
          lte: new Date(),
        },
        succeededAt: null,
        deletedAt: null,
      },
      include: {
        webhook: true,
      },
    });

    let processed = 0;

    for (const delivery of pendingDeliveries) {
      const webhook = Webhook.fromPrisma(delivery.webhook);
      const signature = generateSignature(delivery.payload, webhook.secret);
      const deliveryObj = WebhookDelivery.fromPrisma(delivery);

      try {
        await this.deliverWebhook(webhook, deliveryObj, signature);
        processed++;
      } catch (error) {
        log.error('Failed to process retry queue', {
          deliveryId: delivery.id,
          error: error as Error,
        });
      }
    }

    log.info('Processed webhook retry queue', { count: processed });

    return processed;
  }
}
