import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { WebhookController } from '../controllers/webhookController';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';

const router: ExpressRouter = Router();

// All webhook routes require authentication
router.use(authenticate);

// POST /api/webhooks - Create a new webhook
router.post(
  '/',
  asyncHandler(WebhookController.createWebhook)
);

// GET /api/webhooks - Get all webhooks for current user
router.get(
  '/',
  asyncHandler(WebhookController.getUserWebhooks)
);

// GET /api/webhooks/:id - Get webhook by ID
router.get(
  '/:id',
  asyncHandler(WebhookController.getWebhook)
);

// PUT /api/webhooks/:id - Update a webhook
router.put(
  '/:id',
  asyncHandler(WebhookController.updateWebhook)
);

// DELETE /api/webhooks/:id - Delete a webhook
router.delete(
  '/:id',
  asyncHandler(WebhookController.deleteWebhook)
);

// POST /api/webhooks/:id/pause - Pause a webhook
router.post(
  '/:id/pause',
  asyncHandler(WebhookController.pauseWebhook)
);

// POST /api/webhooks/:id/resume - Resume a webhook
router.post(
  '/:id/resume',
  asyncHandler(WebhookController.resumeWebhook)
);

// POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
router.post(
  '/:id/regenerate-secret',
  asyncHandler(WebhookController.regenerateSecret)
);

// POST /api/webhooks/:id/test - Test a webhook
router.post(
  '/:id/test',
  asyncHandler(WebhookController.testWebhook)
);

// GET /api/webhooks/:id/stats - Get webhook statistics
router.get(
  '/:id/stats',
  asyncHandler(WebhookController.getWebhookStats)
);

// GET /api/webhooks/:webhookId/deliveries - Get deliveries for a webhook
router.get(
  '/:webhookId/deliveries',
  asyncHandler(WebhookController.getWebhookDeliveries)
);

// GET /api/webhooks/deliveries/:id - Get delivery by ID
router.get(
  '/deliveries/:id',
  asyncHandler(WebhookController.getDelivery)
);

// POST /api/webhooks/:webhookId/trigger - Trigger a webhook event (for testing)
router.post(
  '/:webhookId/trigger',
  asyncHandler(WebhookController.triggerEvent)
);

export default router;
