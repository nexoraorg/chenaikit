/**
 * Webhook-related middleware
 *
 * 1. webhookSignatureVerifier  – verifies inbound webhook requests using HMAC
 * 2. webhookRateLimiter        – lightweight per-webhook-id rate limiter
 */

import { Request, Response, NextFunction } from 'express';
import { verifySignature, isIpAllowed } from '../utils/webhookUtils';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// 1. Signature verification (for incoming webhook payloads from 3rd parties)
// ---------------------------------------------------------------------------

/**
 * Verifies that an incoming POST carries a valid `X-Webhook-Signature` header.
 *
 * Usage:
 *   router.post('/inbound', webhookSignatureVerifier(secret), handler);
 *
 * The raw body must be accessible at `req.rawBody` – ensure express is
 * configured with the `verify` option or a body-parser alternative.
 */
export function webhookSignatureVerifier(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;

    if (!signatureHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'X-Webhook-Signature header is required',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // `rawBody` is set by the rawBodyMiddleware below
    const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);

    const valid = verifySignature(rawBody, signatureHeader, secret);

    if (!valid) {
      log.warn('Webhook signature verification failed', {
        ip: req.ip,
        path: req.path,
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Webhook signature is invalid or expired',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// 2. IP whitelist check for webhooks
// ---------------------------------------------------------------------------

/**
 * Middleware factory that rejects requests whose source IP is not in the
 * allowed list.  An empty list means "allow all".
 */
export function webhookIpWhitelist(allowedIps: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? '';

    if (!isIpAllowed(clientIp, allowedIps)) {
      log.warn('Webhook request from disallowed IP', {
        ip: clientIp,
        allowedIps,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Request origin is not whitelisted for this webhook',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// 3. Raw body capture (needed for HMAC verification)
// ---------------------------------------------------------------------------

/**
 * Express middleware that buffers the raw request body and stores it as
 * `req.rawBody` before handing off to JSON body-parser.
 *
 * Mount this BEFORE `express.json()` for the webhook routes.
 *
 * Example:
 *   router.use(rawBodyMiddleware);
 *   router.post('/inbound', webhookSignatureVerifier(secret), handler);
 */
export function rawBodyMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  let data = '';
  req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8'); });
  req.on('end', () => {
    (req as any).rawBody = data;
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}
