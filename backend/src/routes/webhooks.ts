import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { webhookService } from '../services/webhookService';
import { authenticate } from '../middleware/auth';
import { authorizeWebhookManagement } from '../middleware/webhookAuth';
import rateLimit from 'express-rate-limit';

const router: ExpressRouter = Router();

// Rate limiting for webhook management
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: { message: 'Too many webhook requests, try again later.' },
});

// Apply authentication to all webhook routes
router.use(authenticate);
router.use(webhookLimiter);

/**
 * POST /api/webhooks - Create a new webhook
 */
router.post('/', async (req: any, res) => {
  try {
    const { url, events, headers, retryCount, timeout, allowedIps } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'url and events array are required',
        },
      });
    }

    const webhook = await webhookService.createWebhook({
      userId: req.user.id,
      url,
      events,
      headers,
      retryCount,
      timeout,
      allowedIps,
    });

    res.status(201).json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        retryCount: webhook.retryCount,
        timeout: webhook.timeout,
        createdAt: webhook.createdAt,
      },
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_WEBHOOK_ERROR',
        message: 'Failed to create webhook',
      },
    });
  }
});

/**
 * GET /api/webhooks - Get user's webhooks
 */
router.get('/', async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const webhooks = await webhookService.getUserWebhooks(
      req.user.id,
      limit,
      offset
    );

    res.json({
      success: true,
      data: webhooks.map((webhook: any) => ({
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        retryCount: webhook.retryCount,
        timeout: webhook.timeout,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        deliveries: webhook.deliveries,
      })),
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_WEBHOOKS_ERROR',
        message: 'Failed to retrieve webhooks',
      },
    });
  }
});

/**
 * GET /api/webhooks/:id - Get webhook by ID
 */
router.get('/:id', async (req: any, res) => {
  try {
    const webhook = await webhookService.getWebhook(
      req.params.id,
      req.user.role === 'admin' ? undefined : req.user.id
    );

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        headers: JSON.parse(webhook.headers),
        retryCount: webhook.retryCount,
        timeout: webhook.timeout,
        allowedIps: JSON.parse(webhook.allowedIps || '[]'),
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        deliveries: webhook.deliveries,
      },
    });
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_WEBHOOK_ERROR',
        message: 'Failed to retrieve webhook',
      },
    });
  }
});

/**
 * PUT /api/webhooks/:id - Update webhook
 */
router.put('/:id', async (req: any, res) => {
  try {
    const { url, events, headers, retryCount, timeout, allowedIps, isActive } = req.body;

    const webhook = await webhookService.updateWebhook(
      req.params.id,
      req.user.id,
      {
        url,
        events,
        headers,
        retryCount,
        timeout,
        allowedIps,
        isActive,
      }
    );

    res.json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        isActive: webhook.isActive,
        headers: JSON.parse(webhook.headers),
        retryCount: webhook.retryCount,
        timeout: webhook.timeout,
        allowedIps: JSON.parse(webhook.allowedIps || '[]'),
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Update webhook error:', error);
    
    if (error.message === 'Webhook not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_WEBHOOK_ERROR',
        message: 'Failed to update webhook',
      },
    });
  }
});

/**
 * DELETE /api/webhooks/:id - Delete webhook
 */
router.delete('/:id', async (req: any, res) => {
  try {
    await webhookService.deleteWebhook(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    
    if (error.message === 'Webhook not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_WEBHOOK_ERROR',
        message: 'Failed to delete webhook',
      },
    });
  }
});

/**
 * POST /api/webhooks/:id/test - Test webhook delivery
 */
router.post('/:id/test', async (req: any, res) => {
  try {
    const result = await webhookService.testWebhook(req.params.id, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Test webhook error:', error);
    
    if (error.message === 'Webhook not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_WEBHOOK_ERROR',
        message: 'Failed to test webhook',
      },
    });
  }
});

/**
 * GET /api/webhooks/:id/stats - Get webhook statistics
 */
router.get('/:id/stats', async (req: any, res) => {
  try {
    const stats = await webhookService.getWebhookStats(req.params.id, req.user.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get webhook stats error:', error);
    
    if (error.message === 'Webhook not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: 'Failed to retrieve webhook statistics',
      },
    });
  }
});

/**
 * POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
 */
router.post('/:id/regenerate-secret', async (req: any, res) => {
  try {
    const webhook = await webhookService.regenerateSecret(req.params.id, req.user.id);

    res.json({
      success: true,
      data: {
        id: webhook.id,
        secret: webhook.secret,
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Regenerate secret error:', error);
    
    if (error.message === 'Webhook not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REGENERATE_SECRET_ERROR',
        message: 'Failed to regenerate webhook secret',
      },
    });
  }
});

export default router;
