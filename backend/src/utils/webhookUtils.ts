import crypto from 'crypto';
import type { WebhookEventPayload, WebhookEventType } from '../models/Webhook';

// ---------------------------------------------------------------------------
// Secret generation & hashing
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random webhook signing secret.
 * Format: `whsec_<32 random hex bytes>`
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Returns the SHA-256 hash of a webhook secret (used for storage so the
 * raw secret is never kept in plaintext in the DB after creation).
 */
export function hashWebhookSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

// ---------------------------------------------------------------------------
// HMAC signature
// ---------------------------------------------------------------------------

/**
 * Computes the HMAC-SHA256 signature for a webhook payload.
 *
 * The signed string is: `<timestamp>.<payloadJson>`
 * The `X-Webhook-Signature` header value is: `t=<timestamp>,v1=<hex digest>`
 */
export function signPayload(
  payloadJson: string,
  secret: string,
  timestampMs: number = Date.now()
): string {
  const signedString = `${timestampMs}.${payloadJson}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(signedString)
    .digest('hex');
  return `t=${timestampMs},v1=${hmac}`;
}

/**
 * Verifies an incoming `X-Webhook-Signature` header against the raw body and
 * the known secret.  Rejects signatures older than `toleranceMs` (default 5 min).
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceMs = 5 * 60 * 1000
): boolean {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [k, ...rest] = part.split('=');
        return [k, rest.join('=')];
      })
    );

    const timestamp = parseInt(parts['t'] ?? '', 10);
    const receivedSig = parts['v1'];

    if (!timestamp || !receivedSig) return false;

    // Reject stale signatures
    if (Math.abs(Date.now() - timestamp) > toleranceMs) return false;

    const expected = signPayload(rawBody, secret, timestamp);
    const expectedSig = expected.split(',v1=')[1];

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Retry backoff
// ---------------------------------------------------------------------------

/**
 * Calculates the next retry delay using exponential backoff with jitter.
 * Delays: ~1 s, ~2 s, ~4 s, ~8 s … capped at `maxDelayMs`.
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 64_000
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exponential * 0.2; // 20% jitter
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Returns the Date at which the next retry should be attempted.
 */
export function nextRetryAt(attempt: number): Date {
  const delayMs = calculateRetryDelay(attempt);
  return new Date(Date.now() + delayMs);
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/**
 * Constructs a standardised webhook event payload.
 */
export function buildEventPayload(
  type: WebhookEventType,
  data: Record<string, unknown>,
  version = '1.0'
): WebhookEventPayload {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    version,
    data,
  };
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Returns true only for https:// URLs (TLS enforcement).
 * Allows http:// in development to ease local testing.
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (process.env.NODE_ENV === 'production') {
      return parsed.protocol === 'https:';
    }
    return ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IP address helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the given IP is in the whitelist.
 * An empty list means "allow all".
 */
export function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  if (allowedIps.length === 0) return true;
  return allowedIps.includes(ip);
}
