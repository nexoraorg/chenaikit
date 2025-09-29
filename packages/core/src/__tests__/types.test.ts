/**
 * Tests for type definitions and utilities
 */

import { ChenAIKitConfig, ChenAIKitError, ValidationError } from '../types';

describe('Type Definitions', () => {
  describe('ChenAIKitConfig', () => {
    it('should accept valid configuration', () => {
      const config: ChenAIKitConfig = {
        stellar: {
          network: 'testnet',
          horizonUrl: 'https://horizon-testnet.stellar.org',
        },
        ai: {
          apiBaseUrl: 'https://api.chenaikit.com',
        },
        cache: {
          ttl: 300,
        },
      };

      expect(config.stellar.network).toBe('testnet');
      expect(config.ai.apiBaseUrl).toBe('https://api.chenaikit.com');
      expect(config.cache.ttl).toBe(300);
    });
  });

  describe('Error Classes', () => {
    it('should create ChenAIKitError with message', () => {
      const error = new ChenAIKitError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ChenAIKitError');
      expect(error.code).toBeUndefined();
    });

    it('should create ChenAIKitError with code and details', () => {
      const error = new ChenAIKitError('Test error', 'TEST_CODE', { foo: 'bar' });
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ChenAIKitError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ foo: 'bar' });
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Validation failed', { field: 'email' });
      
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });
  });
});
