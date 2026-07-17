import { prisma } from '../prisma/client';
import { generateSignature, calculateNextRetry, parseHeaders, stringifyHeaders, parseEvents, redactSensitiveFields } from '../utils/webhookUtils';
import { WebhookEventType, WebhookPayload } from '../models/Webhook';
import crypto from 'crypto';

class WebhookService {
  /**
   * Create a new webhook
   */
  async createWebhook(data: {
    userId: string;
    url: string;
    events: string[];
    headers?: Record<string, string>;
    retryCount?: number;
    timeout?: number;
    allowedIps?: string[];
  }) {
    const secret = this.generateSecret();
    
    return prisma.webhook.create({
      data: {
        userId: data.userId,
        url: data.url,
        events: JSON.stringify(data.events),
        secret,
        headers: stringifyHeaders(data.headers || {}),
        retryCount: data.retryCount || 3,
        timeout: data.timeout || 5000,
        allowedIps: JSON.stringify(data.allowedIps || []),
      },
    });
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }
    
    return prisma.webhook.findUnique({
      where,
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Get user's webhooks
   */
  async getUserWebhooks(userId: string, limit = 10, offset = 0) {
    return prisma.webhook.findMany({
      where: { userId, deletedAt: null },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, userId: string, data: {
    url?: string;
    events?: string[];
    headers?: Record<string, string>;
    retryCount?: number;
    timeout?: number;
    allowedIps?: string[];
    isActive?: boolean;
  }) {
    const webhook = await this.getWebhook(id, userId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const updateData: any = {};
    if (data.url) updateData.url = data.url;
    if (data.events) updateData.events = JSON.stringify(data.events);
    if (data.headers) updateData.headers = stringifyHeaders(data.headers);
    if (data.retryCount !== undefined) updateData.retryCount = data.retryCount;
    if (data.timeout !== undefined) updateData.timeout = data.timeout;
    if (data.allowedIps !== undefined) updateData.allowedIps = JSON.stringify(data.allowedIps);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.webhook.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete webhook (soft delete)
   */
  async deleteWebhook(id: string, userId: string) {
    const webhook = await this.getWebhook(id, userId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return prisma.webhook.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(eventType: WebhookEventType, payload: any) {
    // Find all active webhooks that listen to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    const webhookPayload: WebhookPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      data: payload,
      webhookId: '',
    };

    for (const webhook of webhooks) {
      const events = parseEvents(webhook.events);
      if (events.includes(eventType)) {
        webhookPayload.webhookId = webhook.id;
        await this.deliverWebhook(webhook, webhookPayload);
      }
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(webhook: any, payload: WebhookPayload, attempt = 1) {
    const webhookId = webhook.id;
    const payloadString = JSON.stringify(payload);
    const signature = generateSignature(payloadString, webhook.secret);
    const headers = parseHeaders(webhook.headers);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Id': webhookId,
          'X-Webhook-Event': payload.eventType,
          ...headers,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const success = response.ok;
      const statusCode = response.status;
      const responseText = await response.text();

      // Redact sensitive fields before logging
      const redactedPayload = JSON.stringify(redactSensitiveFields(payload));

      // Log delivery
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType: payload.eventType,
          payload: redactedPayload,
          statusCode,
          response: responseText,
          attempt,
          success,
          deliveredAt: new Date(),
        },
      });

      // If failed and retry attempts remaining, schedule retry
      if (!success && attempt < webhook.retryCount) {
        const nextRetryAt = calculateNextRetry(attempt);
        await prisma.webhookDelivery.create({
          data: {
            webhookId,
            eventType: payload.eventType,
            payload: redactedPayload,
            attempt: attempt + 1,
            success: false,
            nextRetryAt,
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Redact sensitive fields before logging
      const redactedPayload = JSON.stringify(redactSensitiveFields(payload));

      // Log failed delivery
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType: payload.eventType,
          payload: redactedPayload,
          attempt,
          success: false,
          error: errorMessage,
        },
      });

      // Schedule retry if attempts remaining
      if (attempt < webhook.retryCount) {
        const nextRetryAt = calculateNextRetry(attempt);
        await prisma.webhookDelivery.create({
          data: {
            webhookId,
            eventType: payload.eventType,
            payload: redactedPayload,
            attempt: attempt + 1,
            success: false,
            nextRetryAt,
          },
        });
      }
    }
  }

  /**
   * Process pending webhook retries
   */
  async processRetries() {
    const pendingDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        success: false,
        nextRetryAt: {
          lte: new Date(),
        },
      },
      include: {
        webhook: true,
      },
    });

    for (const delivery of pendingDeliveries) {
      if (!delivery.webhook.isActive) continue;

      const payload = JSON.parse(delivery.payload);
      await this.deliverWebhook(delivery.webhook, payload, delivery.attempt);

      // Mark original delivery as processed
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextRetryAt: null },
      });
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(id: string, userId: string) {
    const webhook = await this.getWebhook(id, userId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      eventType: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook delivery' },
      webhookId: webhook.id,
    };

    try {
      await this.deliverWebhook(webhook, testPayload);
      
      // Get the most recent delivery to check success
      const latestDelivery = await prisma.webhookDelivery.findFirst({
        where: { webhookId: id, eventType: 'test' },
        orderBy: { createdAt: 'desc' },
      });

      if (latestDelivery) {
        return {
          success: latestDelivery.success,
          message: latestDelivery.success ? 'Test webhook delivered successfully' : 'Test webhook delivery failed',
          statusCode: latestDelivery.statusCode,
          response: latestDelivery.response,
          error: latestDelivery.error,
        };
      }

      return { success: true, message: 'Test webhook delivered' };
    } catch (error) {
      return {
        success: false,
        message: 'Test webhook delivery failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(id: string, userId: string) {
    const webhook = await this.getWebhook(id, userId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: id },
    });

    const total = deliveries.length;
    const successful = deliveries.filter(d => d.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      successRate: successRate.toFixed(2) + '%',
      lastDelivery: deliveries[0]?.createdAt || null,
    };
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(id: string, userId: string) {
    const webhook = await this.getWebhook(id, userId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const newSecret = this.generateSecret();

    return prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });
  }

  /**
   * Generate random secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const webhookService = new WebhookService();
