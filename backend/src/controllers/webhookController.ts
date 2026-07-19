import { Request, Response } from 'express';
import { WebhookService } from '../services/webhookService';
import { WebhookCreateInput, WebhookUpdateInput } from '../models/Webhook';
import { WebhookEventType } from '../utils/webhookUtils';
import { NotFoundError, ValidationError } from '../utils/errors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const webhookService = new WebhookService(prisma);

export class WebhookController {
  /**
   * Create a new webhook
   */
  static async createWebhook(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const input: WebhookCreateInput = {
      userId,
      url: req.body.url,
      secret: req.body.secret,
      eventTypes: req.body.eventTypes,
      allowedIps: req.body.allowedIps,
      headers: req.body.headers,
      retryConfig: req.body.retryConfig,
    };

    const result = await webhookService.createWebhook(input);

    res.status(201).json({
      success: true,
      data: {
        webhook: result.webhook.toJSON(),
        secret: result.secret,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get webhook by ID
   */
  static async getWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const webhook = await webhookService.getWebhookById(id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found', { webhookId: id });
    }

    res.status(200).json({
      success: true,
      data: webhook.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all webhooks for the current user
   */
  static async getUserWebhooks(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const webhooks = await webhookService.getWebhooksByUserId(userId);

    res.status(200).json({
      success: true,
      data: webhooks.map(w => w.toJSON()),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update a webhook
   */
  static async updateWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const input: WebhookUpdateInput = req.body;

    const webhook = await webhookService.updateWebhook(id, input);

    res.status(200).json({
      success: true,
      data: webhook.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Delete a webhook
   */
  static async deleteWebhook(req: Request, res: Response) {
    const { id } = req.params;
    await webhookService.deleteWebhook(id);

    res.status(204).send();
  }

  /**
   * Pause a webhook
   */
  static async pauseWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const webhook = await webhookService.pauseWebhook(id);

    res.status(200).json({
      success: true,
      data: webhook.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resume a webhook
   */
  static async resumeWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const webhook = await webhookService.resumeWebhook(id);

    res.status(200).json({
      success: true,
      data: webhook.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Regenerate webhook secret
   */
  static async regenerateSecret(req: Request, res: Response) {
    const { id } = req.params;
    const newSecret = await webhookService.regenerateSecret(id);

    res.status(200).json({
      success: true,
      data: { secret: newSecret },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Test a webhook
   */
  static async testWebhook(req: Request, res: Response) {
    const { id } = req.params;
    const delivery = await webhookService.testWebhook(id);

    res.status(200).json({
      success: true,
      data: delivery.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get webhook delivery by ID
   */
  static async getDelivery(req: Request, res: Response) {
    const { id } = req.params;
    const delivery = await webhookService.getDeliveryById(id);

    if (!delivery) {
      throw new NotFoundError('Webhook delivery not found', { deliveryId: id });
    }

    res.status(200).json({
      success: true,
      data: delivery.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get deliveries for a webhook
   */
  static async getWebhookDeliveries(req: Request, res: Response) {
    const { webhookId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const deliveries = await webhookService.getDeliveriesByWebhookId(webhookId, limit);

    res.status(200).json({
      success: true,
      data: deliveries.map(d => d.toJSON()),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(req: Request, res: Response) {
    const { webhookId } = req.params;
    const stats = await webhookService.getWebhookStats(webhookId);

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Trigger a webhook event (for testing/internal use)
   */
  static async triggerEvent(req: Request, res: Response) {
    const { webhookId } = req.params;
    const { eventType, data } = req.body;

    const webhook = await webhookService.getWebhookById(webhookId);
    if (!webhook) {
      throw new NotFoundError('Webhook not found', { webhookId });
    }

    const delivery = await webhookService.triggerWebhook(
      webhook,
      eventType as WebhookEventType,
      data
    );

    res.status(200).json({
      success: true,
      data: delivery.toJSON(),
      timestamp: new Date().toISOString(),
    });
  }
}
