/**
 * Cryptographic utilities
 */

/**
 * Generate a random string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Hash a string using a simple hash function
 */
export function simpleHash(str: string): string {
  let hash = 0;
  
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Generate a hash from multiple strings
 */
export function generateHash(...strings: string[]): string {
  return simpleHash(strings.join('|'));
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Check if running in Node.js environment
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions && !!process.versions.node;
}

/**
 * Generate a timestamp-based ID
 */
export function generateTimestampId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Create a hash from object properties
 */
export function hashObject(obj: Record<string, any>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return simpleHash(str);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 32): string {
  if (isBrowser()) {
    // Use crypto.getRandomValues in browser
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback for Node.js
    return generateRandomString(length);
  }
}

/**
 * Create a deterministic hash from input
 */
export function createDeterministicHash(input: string, seed = 0): number {
  let hash = seed;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Generate a short ID from a longer string
 */
export function generateShortId(input: string, length = 8): string {
  const hash = simpleHash(input);
  return hash.substring(0, length);
}
