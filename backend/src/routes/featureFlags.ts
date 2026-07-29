import { Router, Request, Response } from 'express';
import { featureFlagService } from '../services/featureFlagService';
import { featureFlagMiddleware } from '../middleware/featureFlags';
import { FeatureFlagCreateInput, FeatureFlagUpdateInput, FlagContext } from '../models/FeatureFlag';
import { log } from '../utils/logger';
import { validate } from '../middleware/validation';
import {
  createFeatureFlagBodySchema,
  updateFeatureFlagBodySchema,
  evaluateFlagsBodySchema,
  setOverrideBodySchema,
  flagKeyParamsSchema,
} from '../schemas';

export function createFeatureFlagRouter(): Router {
  const router = Router();

  router.use(featureFlagMiddleware());

  router.get('/evaluate', (_req: Request, res: Response) => {
    try {
      const results = featureFlagService.evaluateFlags();
      res.json({ success: true, data: results });
    } catch (error) {
      log.error('Failed to evaluate flags', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_EVALUATION_FAILED',
          message: 'Failed to evaluate flags',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.post(
    '/evaluate',
    validate({ body: evaluateFlagsBodySchema }),
    (req: Request, res: Response) => {
    try {
      const context: FlagContext = req.body.context || {};
      const keys: string[] = req.body.keys;

      const results = keys
        ? featureFlagService.evaluateFlagsByKeys(keys, context)
        : featureFlagService.evaluateFlags(context);

      res.json({ success: true, data: results });
    } catch (error) {
      log.error('Failed to evaluate flags with context', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_EVALUATION_FAILED',
          message: 'Failed to evaluate flags',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.get('/audit-log', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const entries = featureFlagService.getAuditLog(limit);
      res.json({ success: true, data: entries });
    } catch (error) {
      log.error('Failed to fetch audit log', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_LOG_FETCH_FAILED',
          message: 'Failed to fetch audit log',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.get('/analytics', (_req: Request, res: Response) => {
    try {
      const analytics = featureFlagService.getAllAnalytics();
      const metrics = featureFlagService.getSystemMetrics();
      res.json({
        success: true,
        data: {
          metrics,
          flags: analytics,
        },
      });
    } catch (error) {
      log.error('Failed to fetch analytics', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: 'Failed to fetch analytics',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.get(
    '/:key',
    validate({ params: flagKeyParamsSchema }),
    (req: Request, res: Response) => {
    try {
      const flag = featureFlagService.getFlag(req.params.key);
      if (!flag) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FLAG_NOT_FOUND',
            message: `Flag '${req.params.key}' not found`,
            timestamp: new Date().toISOString(),
          },
        });
      }
      const analytics = featureFlagService.getAnalytics(req.params.key);
      res.json({ success: true, data: { flag, analytics } });
    } catch (error) {
      log.error('Failed to get flag', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_FETCH_FAILED',
          message: 'Failed to get flag',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.put(
    '/:key',
    validate({ params: flagKeyParamsSchema, body: updateFeatureFlagBodySchema }),
    (req: Request, res: Response) => {
    try {
      const input: FeatureFlagUpdateInput = req.body;
      const flag = featureFlagService.updateFlag(req.params.key, input);
      res.json({ success: true, data: flag });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FLAG_NOT_FOUND',
            message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      log.error('Failed to update flag', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_UPDATE_FAILED',
          message: 'Failed to update flag',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.delete(
    '/:key',
    validate({ params: flagKeyParamsSchema }),
    (req: Request, res: Response) => {
    try {
      featureFlagService.deleteFlag(req.params.key);
      res.json({
        success: true,
        data: { message: `Flag '${req.params.key}' deleted` },
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FLAG_NOT_FOUND',
            message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      log.error('Failed to delete flag', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_DELETE_FAILED',
          message: 'Failed to delete flag',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.post(
    '/:key/toggle',
    validate({ params: flagKeyParamsSchema }),
    (req: Request, res: Response) => {
    try {
      const flag = featureFlagService.toggleFlag(req.params.key);
      res.json({ success: true, data: flag });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FLAG_NOT_FOUND',
            message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      log.error('Failed to toggle flag', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_TOGGLE_FAILED',
          message: 'Failed to toggle flag',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.post(
    '/:key/override',
    validate({ params: flagKeyParamsSchema, body: setOverrideBodySchema }),
    (req: Request, res: Response) => {
    try {
      const { value } = req.body;
      featureFlagService.setOverride(req.params.key, value);
      res.json({
        success: true,
        data: { key: req.params.key, override: value },
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FLAG_NOT_FOUND',
            message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      log.error('Failed to set override', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'OVERRIDE_FAILED',
          message: 'Failed to set override',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.delete(
    '/:key/override',
    validate({ params: flagKeyParamsSchema }),
    (req: Request, res: Response) => {
    try {
      featureFlagService.clearOverride(req.params.key);
      res.json({
        success: true,
        data: { message: `Override cleared for '${req.params.key}'` },
      });
    } catch (error) {
      log.error('Failed to clear override', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'OVERRIDE_CLEAR_FAILED',
          message: 'Failed to clear override',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.get('/', (_req: Request, res: Response) => {
    try {
      const flags = featureFlagService.getAllFlags();
      res.json({ success: true, data: flags });
    } catch (error) {
      log.error('Failed to list flags', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAGS_FETCH_FAILED',
          message: 'Failed to list flags',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  router.post(
    '/',
    validate({ body: createFeatureFlagBodySchema }),
    (req: Request, res: Response) => {
    try {
      const input: FeatureFlagCreateInput = req.body;
      const flag = featureFlagService.createFlag(input);
      res.status(201).json({ success: true, data: flag });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'FLAG_ALREADY_EXISTS',
            message,
            timestamp: new Date().toISOString(),
          },
        });
      }
      log.error('Failed to create flag', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FLAG_CREATE_FAILED',
          message: 'Failed to create flag',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  return router;
}
