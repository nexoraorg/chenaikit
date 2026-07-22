import { Request, Response, NextFunction } from 'express';
import { verifySignature, extractSignatureFromHeaders } from '../utils/webhookUtils';
import { log } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      webhookId?: string;
      webhookEventType?: string;
    }
  }
}

export interface WebhookAuthOptions {
  /**
   * Whether to require signature verification
   * @default true
   */
  requireSignature?: boolean;

  /**
   * Prisma client instance for fetching webhook secrets
   */
  prisma?: PrismaClient;

  /**
   * Custom function to get webhook secret
   */
  getSecret?: (webhookId: string) => Promise<string | null>;
}

/**
 * Middleware to verify webhook signatures
 */
export const webhookAuth = (options: WebhookAuthOptions = {}) => {
  const {
    requireSignature = true,
    prisma,
    getSecret,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract webhook ID from headers
      const webhookId = req.headers['x-webhook-id'] as string;
      if (!webhookId) {
        return res.status(400).json({ message: 'Missing X-Webhook-ID header' });
      }

      req.webhookId = webhookId;

      // Extract event type from headers
      const eventType = req.headers['x-webhook-event'] as string;
      if (eventType) {
        req.webhookEventType = eventType;
      }

      // If signature verification is not required, skip it
      if (!requireSignature) {
        return next();
      }

      // Get the raw body for signature verification
      const rawBody = req.body;
      if (typeof rawBody !== 'string') {
        return res.status(400).json({ message: 'Request body must be a string for signature verification' });
      }

      // Extract signature from headers
      const signature = extractSignatureFromHeaders(req.headers as Record<string, string>);
      if (!signature) {
        return res.status(401).json({ message: 'Missing signature header' });
      }

      // Get webhook secret
      let secret: string | null = null;

      if (getSecret) {
        secret = await getSecret(webhookId);
      } else if (prisma) {
        const webhook = await prisma.webhook.findUnique({
          where: { id: webhookId },
        });
        secret = webhook?.secret || null;
      }

      if (!secret) {
        return res.status(404).json({ message: 'Webhook not found' });
      }

      // Verify signature
      const isValid = verifySignature(rawBody, signature, secret);
      if (!isValid) {
        log.warn('Webhook signature verification failed', {
          webhookId,
          eventType,
          signature: signature.substring(0, 20) + '...',
        });

        return res.status(401).json({ message: 'Invalid signature' });
      }

      log.info('Webhook signature verified', {
        webhookId,
        eventType,
      });

      next();
    } catch (error) {
      log.error('Webhook authentication error', {
        error: error as Error,
        webhookId: req.webhookId,
      });

      return res.status(500).json({ message: 'Authentication error' });
    }
  };
};

/**
 * Middleware to verify IP whitelist for webhooks
 */
export const webhookIpWhitelist = (allowedIps: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '';

    if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
      log.warn('Webhook IP not in whitelist', {
        ip,
        allowedIps,
      });

      return res.status(403).json({ message: 'IP not allowed' });
    }

    next();
  };
};

/**
 * Middleware to rate limit webhook deliveries
 */
export const webhookRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const webhookId = req.webhookId || 'unknown';
    const now = Date.now();

    // Get existing requests for this webhook
    const webhookRequests = requests.get(webhookId) || [];

    // Filter out old requests outside the window
    const recentRequests = webhookRequests.filter(timestamp => now - timestamp < windowMs);

    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      log.warn('Webhook rate limit exceeded', {
        webhookId,
        requestCount: recentRequests.length,
      });

      return res.status(429).json({ message: 'Rate limit exceeded' });
    }

    // Add current request
    recentRequests.push(now);
    requests.set(webhookId, recentRequests);

    next();
  };
};
