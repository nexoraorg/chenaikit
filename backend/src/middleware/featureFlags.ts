import { Request, Response, NextFunction } from 'express';
import { featureFlagService } from '../services/featureFlagService';
import { FlagContext } from '../models/FeatureFlag';

export interface FeatureFlagMiddlewareOptions {
  flags?: string[];
  exposeHeaders?: boolean;
}

export function featureFlagMiddleware(options: FeatureFlagMiddlewareOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const context = buildFlagContext(req);
      const evaluations = options.flags
        ? featureFlagService.evaluateFlagsByKeys(options.flags, context)
        : featureFlagService.evaluateFlags(context);

      req.featureFlags = {};
      for (const evalResult of evaluations) {
        req.featureFlags[evalResult.flagKey] = evalResult;
      }

      if (options.exposeHeaders) {
        for (const evalResult of evaluations) {
          _res.setHeader(`X-Feature-${evalResult.flagKey}`, String(evalResult.value));
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireFeatureFlag(flagKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const evaluation = req.featureFlags?.[flagKey];
    if (!evaluation || !evaluation.value) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Feature '${flagKey}' is not available`,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    next();
  };
}

export function buildFlagContext(req: Request): FlagContext {
  const context: FlagContext = {
    userId: (req as any).user?.id || (req as any).user?.sub,
    email: (req as any).user?.email,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    properties: {
      method: req.method,
      path: req.path,
      host: req.hostname,
    },
  };

  if (req.headers['x-segments']) {
    context.segments = (req.headers['x-segments'] as string).split(',').map((s) => s.trim());
  }

  return context;
}
