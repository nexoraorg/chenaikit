import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';

export interface GeneratedKey {
  key: string;
  hash: string;
  prefix: string;
}

/**
 * Generate a cryptographically secure API key with a prefix.
 * Default prefix is 'ak_live_'.
 */
export async function generateApiKey(prefix: string = 'ak_live_'): Promise<GeneratedKey> {
  // Generate 32 bytes of random data for the key itself
  const buffer = randomBytes(32);
  const keyBody = buffer.toString('hex');
  const key = `${prefix}${keyBody}`;
  
  // Hash the key using argon2
  const hash = await argon2.hash(key);
  
  return {
    key,
    hash,
    prefix
  };
}

/**
 * Verify a plain text key against a hash.
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key);
  } catch (error) {
    return false;
  }
}

/**
 * Mask an API key for display (e.g., ak_live_...abcd)
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const prefixMatch = key.match(/^(ak_[a-z]+_)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const body = key.slice(prefix.length);
  
  if (body.length <= 8) {
    return `${prefix}${'*'.repeat(body.length)}`;
  }
  
  return `${prefix}${body.slice(0, 4)}...${body.slice(-4)}`;
}
