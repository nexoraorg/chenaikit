/**
 * Tests for utility functions
 */

import { 
  isValidEmail, 
  isValidUUID, 
  validateRequired, 
  validateStringLength,
  validateNumberRange,
  isValidURL,
  sanitizeString,
  isValidQuestDifficulty,
  isValidQuestCategory,
  isValidBadgeRarity,
  isValidQuestStatus
} from '../utils/validation';

import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  truncateText,
  capitalizeWords,
  camelToKebab,
  kebabToCamel,
  generateInitials,
  formatXP
} from '../utils/formatting';

import {
  generateRandomString,
  generateUUID,
  simpleHash,
  generateHash,
  isBrowser,
  isNode,
  generateTimestampId,
  hashObject,
  generateSecureToken,
  createDeterministicHash,
  generateShortId
} from '../utils/crypto';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test.example.com')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should pass validation for required fields', () => {
      expect(() => {
        validateRequired({ name: 'test', email: 'test@example.com' }, ['name', 'email']);
      }).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      expect(() => {
        validateRequired({ name: 'test' }, ['name', 'email']);
      }).toThrow('Missing required fields: email');
    });
  });

  describe('validateStringLength', () => {
    it('should validate string length', () => {
      expect(() => {
        validateStringLength('hello', 3, 10, 'name');
      }).not.toThrow();

      expect(() => {
        validateStringLength('hi', 3, 10, 'name');
      }).toThrow('name must be at least 3 characters long');

      expect(() => {
        validateStringLength('very long string', 3, 10, 'name');
      }).toThrow('name must be no more than 10 characters long');
    });
  });

  describe('validateNumberRange', () => {
    it('should validate number range', () => {
      expect(() => {
        validateNumberRange(5, 1, 10, 'age');
      }).not.toThrow();

      expect(() => {
        validateNumberRange(0, 1, 10, 'age');
      }).toThrow('age must be at least 1');

      expect(() => {
        validateNumberRange(15, 1, 10, 'age');
      }).toThrow('age must be no more than 10');
    });
  });

  describe('isValidURL', () => {
    it('should validate URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://localhost:3000')).toBe(true);
      expect(isValidURL('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidURL('not-a-url')).toBe(false);
      expect(isValidURL('http://')).toBe(false);
      expect(isValidURL('')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize string input', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
      expect(sanitizeString('test<script>alert("xss")</script>')).toBe('testscriptalert("xss")/script');
    });
  });

  describe('quest validation', () => {
    it('should validate quest difficulty', () => {
      expect(isValidQuestDifficulty('beginner')).toBe(true);
      expect(isValidQuestDifficulty('expert')).toBe(true);
      expect(isValidQuestDifficulty('invalid')).toBe(false);
    });

    it('should validate quest category', () => {
      expect(isValidQuestCategory('frontend')).toBe(true);
      expect(isValidQuestCategory('blockchain')).toBe(true);
      expect(isValidQuestCategory('invalid')).toBe(false);
    });

    it('should validate badge rarity', () => {
      expect(isValidBadgeRarity('common')).toBe(true);
      expect(isValidBadgeRarity('legendary')).toBe(true);
      expect(isValidBadgeRarity('invalid')).toBe(false);
    });

    it('should validate quest status', () => {
      expect(isValidQuestStatus('completed')).toBe(true);
      expect(isValidQuestStatus('in_progress')).toBe(true);
      expect(isValidQuestStatus('invalid')).toBe(false);
    });
  });
});

describe('Formatting Utils', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(0)).toBe('0 Bytes');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(3661000)).toBe('1h 1m 1s');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages', () => {
      expect(formatPercentage(0.5)).toBe('50.0%');
      expect(formatPercentage(0.123, 2)).toBe('12.30%');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    });
  });

  describe('truncateText', () => {
    it('should truncate text with ellipsis', () => {
      expect(truncateText('hello world', 8)).toBe('hello...');
      expect(truncateText('short', 10)).toBe('short');
    });
  });

  describe('capitalizeWords', () => {
    it('should capitalize first letter of each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
      expect(capitalizeWords('test string')).toBe('Test String');
    });
  });

  describe('case conversion', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(camelToKebab('camelCaseString')).toBe('camel-case-string');
      expect(camelToKebab('XMLHttpRequest')).toBe('xmlhttp-request');
    });

    it('should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('kebab-case-string')).toBe('kebabCaseString');
      expect(kebabToCamel('single')).toBe('single');
    });
  });

  describe('generateInitials', () => {
    it('should generate initials from name', () => {
      expect(generateInitials('John Doe')).toBe('JD');
      expect(generateInitials('Alice Bob Charlie')).toBe('AB');
    });
  });

  describe('formatXP', () => {
    it('should format experience points', () => {
      expect(formatXP(1500)).toBe('1.5K XP');
      expect(formatXP(1500000)).toBe('1.5M XP');
      expect(formatXP(500)).toBe('500 XP');
    });
  });
});

describe('Crypto Utils', () => {
  describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
      const str = generateRandomString(10);
      expect(str).toHaveLength(10);
      expect(typeof str).toBe('string');
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('simpleHash', () => {
    it('should generate consistent hash', () => {
      const hash1 = simpleHash('test');
      const hash2 = simpleHash('test');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = simpleHash('test1');
      const hash2 = simpleHash('test2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateHash', () => {
    it('should generate hash from multiple strings', () => {
      const hash = generateHash('part1', 'part2', 'part3');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('environment detection', () => {
    it('should detect environment', () => {
      expect(typeof isBrowser()).toBe('boolean');
      expect(typeof isNode()).toBe('boolean');
    });
  });

  describe('generateTimestampId', () => {
    it('should generate timestamp-based ID', () => {
      const id = generateTimestampId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('hashObject', () => {
    it('should generate consistent hash from object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const hash1 = hashObject(obj);
      const hash2 = hashObject(obj);
      expect(hash1).toBe(hash2);
    });
  });

  describe('generateShortId', () => {
    it('should generate short ID from input', () => {
      const shortId = generateShortId('very long input string', 8);
      expect(shortId).toHaveLength(8);
      expect(typeof shortId).toBe('string');
    });
  });
});
