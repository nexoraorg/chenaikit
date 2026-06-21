/**
 * Sensitive data redaction for log entries.
 * Fields matching SENSITIVE_KEYS are replaced with '[REDACTED]'.
 * Values matching SENSITIVE_PATTERNS (e.g. credit cards, JWTs) are masked.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'api_key',
  'authorization',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'ssn',
  'privatekey',
  'private_key',
  'cookie',
  'session',
  'otp',
  'pin',
]);

/** Regex patterns to scrub from string values */
const SENSITIVE_PATTERNS: Array<{ re: RegExp; mask: string }> = [
  // JWT  (3 base64url segments)
  { re: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, mask: '[JWT_REDACTED]' },
  // Credit card numbers (Luhn-like: 13-19 digits with optional spaces/dashes)
  { re: /\b(?:\d[ -]?){13,19}\b/g, mask: '[CARD_REDACTED]' },
  // Bearer token in header value
  { re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, mask: 'Bearer [TOKEN_REDACTED]' },
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''));
}

function scrubString(value: string): string {
  let result = value;
  for (const { re, mask } of SENSITIVE_PATTERNS) {
    result = result.replace(re, mask);
  }
  return result;
}

/**
 * Recursively redact sensitive fields from an object or value.
 * Safe to call with primitives, arrays, or nested objects.
 */
export function redact(value: unknown, _depth = 0): unknown {
  if (_depth > 10) return value; // guard against circular/deeply nested objects
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(item => redact(item, _depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = isSensitiveKey(k) ? '[REDACTED]' : redact(v, _depth + 1);
  }
  return result;
}

/**
 * Redact a flat request body / headers object (shallow + recursive).
 */
export function redactBody(body: unknown): unknown {
  return redact(body);
}

/**
 * Redact HTTP headers, always removing Authorization and Cookie.
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    result[k] = isSensitiveKey(k) ? '[REDACTED]' : (typeof v === 'string' ? scrubString(v) : v);
  }
  return result;
}
