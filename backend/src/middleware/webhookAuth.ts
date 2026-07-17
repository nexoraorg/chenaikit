import { Request, Response, NextFunction } from 'express';
import { verifySignature } from '../utils/webhookUtils';
import { prisma } from '../prisma/client';

declare global {
  namespace Express {
    interface Request {
      webhook?: {
        id: string;
        userId: string;
      };
    }
  }
}

/**
 * Middleware to verify webhook signature
 */
export const verifyWebhookSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const webhookId = req.headers['x-webhook-id'] as string;

  if (!signature || !webhookId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Missing webhook signature or ID',
      },
    });
  }

  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        },
      });
    }

    if (!webhook.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WEBHOOK_INACTIVE',
          message: 'Webhook is inactive',
        },
      });
    }

    // Get raw body for signature verification
    const rawBody = req.body;
    const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    if (!verifySignature(payload, signature, webhook.secret)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature',
        },
      });
    }

    // Check IP whitelist if configured
    if (webhook.allowedIps) {
      const allowedIps = JSON.parse(webhook.allowedIps || '[]');
      const clientIp = req.ip || req.socket.remoteAddress || '';
      
      if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_ALLOWED',
            message: 'IP address not allowed',
          },
        });
      }
    }

    req.webhook = {
      id: webhook.id,
      userId: webhook.userId,
    };

    next();
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SIGNATURE_VERIFICATION_ERROR',
        message: 'Error verifying webhook signature',
      },
    });
  }
};

/**
 * Middleware to check if user has permission to manage webhooks
 */
export const authorizeWebhookManagement = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  // Admin users can manage any webhooks
  if (req.user.role === 'admin') {
    return next();
  }

  // Regular users can only manage their own webhooks
  const webhookId = req.params.id;
  if (webhookId && req.webhook && req.webhook.userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You can only manage your own webhooks',
      },
    });
  }

  next();
};
