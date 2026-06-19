import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { PrismaClient } from '@prisma/client';
import { createRedisClient } from '../config/redis';
import { API_TIER_CONFIGS } from '../models/ApiKey';
import { log } from '../utils/logger';

const prisma = new PrismaClient();
const apiKeyService = new ApiKeyService(prisma);
const redis = createRedisClient();

/**
 * Middleware to authenticate requests using an API key.
 * Implements:
 * - Key validation (Argon2)
 * - Status check (ACTIVE/REVOKED/EXPIRED)
 * - IP Allowlisting
 * - Per-key Rate Limiting (Redis-backed)
 * - Usage Tracking
 */
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
  let key: string | undefined;

  if (typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      key = authHeader.substring(7);
    } else {
      key = authHeader;
    }
  }

  if (!key) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is missing from headers'
      }
    });
  }

  try {
    const apiKey = await apiKeyService.validateApiKey(key);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid'
        }
      });
    }

    // Check status
    if (!apiKey.isActiveStatus()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'API_KEY_DISABLED',
          message: `API key is ${apiKey.status.toLowerCase()}`
        }
      });
    }

    // Check IP allowlist
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (!apiKey.isIpAllowed(clientIp)) {
      await apiKeyService.recordUsage(apiKey.id, false);
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Request from this IP is not allowed for this API key'
        }
      });
    }

    // Check Rate Limiting
    const tierConfig = API_TIER_CONFIGS[apiKey.tier];
    const rateLimitKey = `rate_limit:${apiKey.id}`;
    
    // Simple fixed window rate limiting with Redis
    const currentCount = await redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await redis.pexpire(rateLimitKey, tierConfig.rateLimit.windowMs);
    }

    if (currentCount > tierConfig.rateLimit.max) {
      await apiKeyService.recordUsage(apiKey.id, false);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded for this API key',
          retry_after: await redis.pttl(rateLimitKey)
        }
      });
    }

    // Attach to request
    req.apiKey = apiKey;
    
    // Record usage (asynchronously to not block the request)
    apiKeyService.recordUsage(apiKey.id, true).catch(err => {
      log.error('Failed to record API key usage', { error: err as Error, apiKeyId: apiKey.id });
    });

    next();
  } catch (error) {
    log.error('API key authentication error', { error: error as Error });
    console.error('Detailed API key auth error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during API key authentication',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Middleware to restrict access based on scopes.
 */
export const requireScope = (scope: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.apiKey.hasScope(scope)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `This operation requires the '${scope}' scope`
        }
      });
    }

    next();
  };
};

/**
 * Middleware to restrict access based on permissions.
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.apiKey.hasPermission(permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSION',
          message: `This operation requires the '${permission}' permission`
        }
      });
    }

    next();
  };
};
