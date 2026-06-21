/**
 * Webhook management routes
 *
 * All routes require a valid JWT access token (Bearer scheme).
 *
 * Base path (mounted in v1/v2 index): /webhooks
 *
 * CRUD:
 *   POST   /webhooks              – register a new webhook
 *   GET    /webhooks              – list webhooks for the authenticated user
 *   GET    /webhooks/:id          – get a single webhook
 *   PATCH  /webhooks/:id          – update a webhook
 *   DELETE /webhooks/:id          – soft-delete a webhook
 *
 * Actions:
 *   POST   /webhooks/:id/pause    – pause delivery
 *   POST   /webhooks/:id/resume   – resume delivery
 *   POST   /webhooks/:id/rotate   – rotate signing secret
 *   POST   /webhooks/:id/test     – send a test event
 *
 * Monitoring:
 *   GET    /webhooks/:id/deliveries          – delivery history
 *   GET    /webhooks/:id/stats               – aggregate statistics
 *
 * Inbound:
 *   POST   /webhooks/events                  – HMAC-verified inbound events
 */

import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { WebhookService } from '../services/webhookService';
import { WEBHOOK_EVENT_TYPES, WebhookDeliveryStatus } from '../models/Webhook';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  allowedIps: z.array(z.string().ip()).optional(),
  headers: z.record(z.string()).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(30_000).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  isActive: z.boolean().optional(),
  allowedIps: z.array(z.string().ip()).optional(),
  headers: z.record(z.string()).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(30_000).optional(),
});

const deliveryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const webhookCrudLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
});

const webhookActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
});

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createWebhookRouter(prisma: PrismaClient): ExpressRouter {
  const router: ExpressRouter = Router();
  const service = new WebhookService(prisma);

  // All webhook management routes require authentication
  router.use(authenticate);

  // ----- CRUD ---------------------------------------------------------------

  // POST /webhooks – register a webhook
  router.post(
    '/',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const body = createWebhookSchema.parse(req.body);
      const userId = req.user!.id;

      const { webhook, plainSecret } = await service.createWebhook({
        userId,
        ...body,
      });

      // Return the plain secret once — the caller must store it safely
      res.status(201).json({
        success: true,
        data: {
          ...webhook.toPublic(),
          secret: plainSecret,
        },
        meta: {
          warning:
            'Store this secret securely — it will not be shown again. ' +
            'Use it to verify the X-Webhook-Signature header on deliveries.',
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /webhooks – list webhooks
  router.get(
    '/',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const result = await service.listWebhooks(userId, query);

      res.json({
        success: true,
        data: result.webhooks.map((w) => w.toPublic()),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit),
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /webhooks/:id – get a webhook
  router.get(
    '/:id',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const webhook = await service.getWebhook(req.params.id, req.user!.id);
      res.json({
        success: true,
        data: webhook.toPublic(),
        timestamp: new Date().toISOString(),
      });
    })
  );

  // PATCH /webhooks/:id – update a webhook
  router.patch(
    '/:id',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const body = updateWebhookSchema.parse(req.body);
      const webhook = await service.updateWebhook(req.params.id, req.user!.id, body);
      res.json({
        success: true,
        data: webhook.toPublic(),
        timestamp: new Date().toISOString(),
      });
    })
  );

  // DELETE /webhooks/:id – soft-delete a webhook
  router.delete(
    '/:id',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      await service.deleteWebhook(req.params.id, req.user!.id);
      res.json({
        success: true,
        data: { deleted: true, id: req.params.id },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ----- Actions ------------------------------------------------------------

  // POST /webhooks/:id/pause
  router.post(
    '/:id/pause',
    webhookActionLimiter,
    asyncHandler(async (req, res) => {
      const webhook = await service.setPaused(req.params.id, req.user!.id, true);
      res.json({
        success: true,
        data: { ...webhook.toPublic(), isPaused: true },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /webhooks/:id/resume
  router.post(
    '/:id/resume',
    webhookActionLimiter,
    asyncHandler(async (req, res) => {
      const webhook = await service.setPaused(req.params.id, req.user!.id, false);
      res.json({
        success: true,
        data: { ...webhook.toPublic(), isPaused: false },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /webhooks/:id/rotate – rotate signing secret
  router.post(
    '/:id/rotate',
    webhookActionLimiter,
    asyncHandler(async (req, res) => {
      const newSecret = await service.rotateSecret(req.params.id, req.user!.id);
      res.json({
        success: true,
        data: { secret: newSecret },
        meta: {
          warning:
            'New secret generated. Update your endpoint to verify with this secret. ' +
            'The previous secret is immediately invalidated.',
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /webhooks/:id/test – send a test event
  router.post(
    '/:id/test',
    webhookActionLimiter,
    asyncHandler(async (req, res) => {
      const delivery = await service.sendTestEvent(req.params.id, req.user!.id);
      res.json({
        success: true,
        data: delivery,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ----- Monitoring ---------------------------------------------------------

  // GET /webhooks/:id/deliveries
  router.get(
    '/:id/deliveries',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const query = deliveryQuerySchema.parse(req.query);
      const result = await service.getDeliveries(req.params.id, req.user!.id, {
        page: query.page,
        limit: query.limit,
        status: query.status as WebhookDeliveryStatus | undefined,
      });

      res.json({
        success: true,
        data: result.deliveries,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit),
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /webhooks/:id/stats
  router.get(
    '/:id/stats',
    webhookCrudLimiter,
    asyncHandler(async (req, res) => {
      const stats = await service.getStats(req.params.id, req.user!.id);
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ----- Event catalogue ----------------------------------------------------

  // GET /webhooks/events/types – list all supported event types
  // Note: must be defined BEFORE /:id to avoid collision
  router.get('/events/types', asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        events: WEBHOOK_EVENT_TYPES,
        categories: {
          transaction: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('transaction.')),
          account: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('account.')),
          credit_score: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('credit_score.')),
          fraud: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('fraud.')),
          system: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith('system.')),
        },
      },
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}
