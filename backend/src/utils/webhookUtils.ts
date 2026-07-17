import crypto from 'crypto';

/**
 * Generate HMAC signature for webhook payload verification
 */
export const generateSignature = (payload: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
};

/**
 * Verify HMAC signature from webhook request
 */
export const verifySignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Generate a random webhook secret
 */
export const generateWebhookSecret = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Calculate next retry time with exponential backoff
 */
export const calculateNextRetry = (attempt: number): Date => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 3600000; // 1 hour max
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return new Date(Date.now() + delay);
};

/**
 * Validate webhook URL
 */
export const isValidWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Validate IP address against whitelist
 */
export const isIpAllowed = (ip: string, allowedIps: string[]): boolean => {
  if (allowedIps.length === 0) return true;
  return allowedIps.some(allowedIp => {
    if (allowedIp.includes('/')) {
      // CIDR notation support
      const [network, prefix] = allowedIp.split('/');
      return ip.startsWith(network);
    }
    return ip === allowedIp;
  });
};

/**
 * Parse custom headers from JSON string
 */
export const parseHeaders = (headersJson: string): Record<string, string> => {
  try {
    return JSON.parse(headersJson);
  } catch {
    return {};
  }
};

/**
 * Stringify custom headers to JSON
 */
export const stringifyHeaders = (headers: Record<string, string>): string => {
  return JSON.stringify(headers);
};

/**
 * Parse events from JSON string
 */
export const parseEvents = (eventsJson: string): string[] => {
  try {
    return JSON.parse(eventsJson);
  } catch {
    return [];
  }
};

/**
 * Stringify events to JSON
 */
export const stringifyEvents = (events: string[]): string => {
  return JSON.stringify(events);
};

/**
 * Parse allowed IPs from JSON string
 */
export const parseAllowedIps = (ipsJson: string): string[] => {
  try {
    return JSON.parse(ipsJson);
  } catch {
    return [];
  }
};

/**
 * Stringify allowed IPs to JSON
 */
export const stringifyAllowedIps = (ips: string[]): string => {
  return JSON.stringify(ips);
};
