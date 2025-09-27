/**
 * Validation utilities
 */

import { ValidationError } from '../types';

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate Stellar address
 */
export function isValidStellarAddress(address: string): boolean {
  // Basic Stellar address validation
  return /^G[A-Z0-9]{55}$/.test(address);
}

/**
 * Validate required fields
 */
export function validateRequired(obj: Record<string, any>, fields: string[]): void {
  const missing = fields.filter(field => obj[field] === undefined || obj[field] === null || obj[field] === '');
  
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(value: string, min: number, max: number, fieldName: string): void {
  if (value.length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters long`);
  }
  
  if (value.length > max) {
    throw new ValidationError(`${fieldName} must be no more than ${max} characters long`);
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }
  
  if (value > max) {
    throw new ValidationError(`${fieldName} must be no more than ${max}`);
  }
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate date
 */
export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate quest difficulty
 */
export function isValidQuestDifficulty(difficulty: string): boolean {
  return ['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty);
}

/**
 * Validate quest category
 */
export function isValidQuestCategory(category: string): boolean {
  return ['frontend', 'backend', 'blockchain', 'algorithms', 'devops', 'security', 'testing'].includes(category);
}

/**
 * Validate badge rarity
 */
export function isValidBadgeRarity(rarity: string): boolean {
  return ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity);
}

/**
 * Validate quest status
 */
export function isValidQuestStatus(status: string): boolean {
  return ['not_started', 'in_progress', 'completed', 'failed', 'locked'].includes(status);
}

/**
 * Validate configuration object
 */
export function validateConfig(config: any): void {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Configuration must be an object');
  }

  // Validate Stellar config
  if (config.stellar) {
    if (!config.stellar.horizonUrl || typeof config.stellar.horizonUrl !== 'string') {
      throw new ValidationError('Stellar horizon URL is required and must be a string');
    }
    
    if (!['testnet', 'mainnet'].includes(config.stellar.network)) {
      throw new ValidationError('Stellar network must be either "testnet" or "mainnet"');
    }
  }

  // Validate AI config
  if (config.ai) {
    if (!config.ai.apiBaseUrl || typeof config.ai.apiBaseUrl !== 'string') {
      throw new ValidationError('AI API base URL is required and must be a string');
    }
  }

  // Validate cache config
  if (config.cache) {
    if (config.cache.ttl !== undefined && (typeof config.cache.ttl !== 'number' || config.cache.ttl < 0)) {
      throw new ValidationError('Cache TTL must be a positive number');
    }
  }
}
