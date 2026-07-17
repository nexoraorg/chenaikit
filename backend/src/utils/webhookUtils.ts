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
  
  // Validate signature length before timingSafeEqual to prevent errors
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
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
 * Validate webhook URL - enforce HTTPS and block SSRF destinations
 */
export const isValidWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Block internal/reserved IP addresses
    const hostname = parsed.hostname;
    
    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    
    // Block private IP ranges
    const privateRanges = [
      /^10\./,           // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,     // 192.168.0.0/16
      /^fc00:/i,         // fc00::/7 (unique local)
      /^fe80:/i,         // fe80::/10 (link-local)
      /^::1$/,           // localhost IPv6
    ];
    
    if (privateRanges.some(range => range.test(hostname))) {
      return false;
    }
    
    // Block metadata endpoints (AWS, GCP, Azure)
    const metadataEndpoints = [
      'metadata.google.internal',
      '169.254.169.254',
      'metadata.azure.net',
    ];
    
    if (metadataEndpoints.includes(hostname)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate IP address against whitelist with proper CIDR support
 */
export const isIpAllowed = (ip: string, allowedIps: string[]): boolean => {
  if (allowedIps.length === 0) return true;
  
  return allowedIps.some(allowedIp => {
    if (allowedIp.includes('/')) {
      // Proper CIDR notation support
      return isIpInCidr(ip, allowedIp);
    }
    return ip === allowedIp;
  });
};

/**
 * Check if IP is within CIDR range
 */
const isIpInCidr = (ip: string, cidr: string): boolean => {
  const [network, prefixLength] = cidr.split('/');
  const prefix = parseInt(prefixLength, 10);
  
  // Handle IPv4
  if (ip.includes('.') && network.includes('.')) {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  }
  
  // Handle IPv6 (simplified - for full implementation, use a proper IPv6 library)
  if (ip.includes(':') && network.includes(':')) {
    // For now, do simple prefix matching for IPv6
    return ip.startsWith(network.split('/').shift() || '');
  }
  
  return false;
};

/**
 * Convert IPv4 address to number
 */
const ipToNumber = (ip: string): number => {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
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

/**
 * Redact sensitive fields from webhook payload before storage
 */
export const redactSensitiveFields = (payload: any): any => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const sensitiveFields = [
    'password',
    'secret',
    'token',
    'apiKey',
    'accessToken',
    'refreshToken',
    'creditCard',
    'ssn',
    'socialSecurityNumber',
    'bankAccount',
    'routingNumber',
    'pin',
    'cvv',
    'cvc',
    'email',
    'phone',
    'phoneNumber',
    'address',
    'billingAddress',
    'shippingAddress',
  ];

  const redacted = Array.isArray(payload) ? [...payload] : { ...payload };

  const redactValue = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(redactValue);
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
        
        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = redactValue(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return obj;
  };

  return redactValue(redacted);
};
