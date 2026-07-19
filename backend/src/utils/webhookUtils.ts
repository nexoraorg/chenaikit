import { createHmac, timingSafeEqual } from 'crypto';
import { log } from './logger';

/**
 * Event types that can trigger webhooks
 */
export enum WebhookEventType {
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_UPDATED = 'transaction.updated',
  TRANSACTION_DELETED = 'transaction.deleted',
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_UPDATED = 'account.updated',
  ACCOUNT_DELETED = 'account.deleted',
  SCORE_GENERATED = 'score.generated',
  FRAUD_DETECTED = 'fraud.detected',
  FRAUD_RESOLVED = 'fraud.resolved',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_ERROR = 'system.error',
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify HMAC signature for webhook payload
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  
  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  try {
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    log.error('Signature verification error', { error: error as Error });
    return false;
  }
}

/**
 * Calculate next retry time with exponential backoff
 */
export function calculateNextRetry(attemptCount: number): Date {
  const baseDelay = 1000; // 1 second
  const maxDelay = 3600000; // 1 hour
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attemptCount),
    maxDelay
  );
  
  // Add some jitter to avoid thundering herd
  const jitter = Math.random() * 0.3 * exponentialDelay;
  const delayWithJitter = exponentialDelay + jitter;
  
  return new Date(Date.now() + delayWithJitter);
}

/**
 * Parse JSON string safely
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    log.error('JSON parse error', { error: error as Error, jsonString });
    return defaultValue;
  }
}

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if IP is in allowed list
 */
export function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  if (allowedIps.length === 0) return true;
  return allowedIps.includes(ip);
}

/**
 * Format webhook payload with timestamp and event type
 */
export function formatWebhookPayload(
  eventType: WebhookEventType,
  data: unknown
): string {
  return JSON.stringify({
    id: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 3600000,
  backoffMultiplier: 2,
};

/**
 * Extract signature from headers
 */
export function extractSignatureFromHeaders(headers: Record<string, string>): string | null {
  const signature = headers['x-webhook-signature'] || headers['webhook-signature'];
  return signature || null;
}
