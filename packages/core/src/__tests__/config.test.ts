/**
 * Tests for configuration management
 */

import { ConfigManager, initializeConfig, getConfig, resetConfig } from '../config';
import { ValidationError } from '../types';

describe('ConfigManager', () => {
  let config: ConfigManager;

  beforeEach(() => {
    config = new ConfigManager();
  });

  describe('constructor', () => {
    it('should create config with default values', () => {
      const configData = config.getConfig();
      
      expect(configData.stellar.network).toBe('testnet');
      expect(configData.stellar.horizonUrl).toBe('https://horizon-testnet.stellar.org');
      expect(configData.ai.apiBaseUrl).toBe('https://api.chenaikit.com');
      expect(configData.cache.ttl).toBe(300);
    });

    it('should merge custom config with defaults', () => {
      const customConfig = new ConfigManager({
        stellar: {
          network: 'mainnet',
          horizonUrl: 'https://horizon.stellar.org',
        },
        cache: {
          ttl: 600,
        },
      });

      const configData = customConfig.getConfig();
      
      expect(configData.stellar.network).toBe('mainnet');
      expect(configData.stellar.horizonUrl).toBe('https://horizon.stellar.org');
      expect(configData.cache.ttl).toBe(600);
      expect(configData.ai.apiBaseUrl).toBe('https://api.chenaikit.com'); // Should keep default
    });
  });

  describe('validation', () => {
    it('should throw error for missing horizon URL', () => {
      expect(() => {
        new ConfigManager({
          stellar: {
            network: 'testnet',
            horizonUrl: '',
          },
        });
      }).toThrow(ValidationError);
    });

    it('should throw error for invalid network', () => {
      expect(() => {
        new ConfigManager({
          stellar: {
            network: 'invalid' as any,
            horizonUrl: 'https://horizon-testnet.stellar.org',
          },
        });
      }).toThrow(ValidationError);
    });

    it('should throw error for negative cache TTL', () => {
      expect(() => {
        new ConfigManager({
          cache: {
            ttl: -1,
          },
        });
      }).toThrow(ValidationError);
    });
  });

  describe('methods', () => {
    it('should get and set config values', () => {
      config.set('cache', { ttl: 600, enabled: true });
      
      const cacheConfig = config.get('cache');
      expect(cacheConfig.ttl).toBe(600);
      expect(cacheConfig.enabled).toBe(true);
    });

    it('should update configuration', () => {
      config.updateConfig({
        stellar: {
          network: 'mainnet',
          horizonUrl: 'https://horizon.stellar.org',
        },
      });

      const configData = config.getConfig();
      expect(configData.stellar.network).toBe('mainnet');
      expect(configData.stellar.horizonUrl).toBe('https://horizon.stellar.org');
    });

    it('should detect environment', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);

      process.env.NODE_ENV = 'production';
      expect(config.isDevelopment()).toBe(false);
      expect(config.isProduction()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should detect network type', () => {
      expect(config.isTestnet()).toBe(true);
      expect(config.isMainnet()).toBe(false);

      config.set('stellar', {
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
      });

      expect(config.isTestnet()).toBe(false);
      expect(config.isMainnet()).toBe(true);
    });
  });
});

describe('Global Config Functions', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it('should initialize global config', () => {
    const globalConfig = initializeConfig({
      stellar: {
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
      },
    });

    expect(globalConfig.getNetwork()).toBe('mainnet');
  });

  it('should get default global config', () => {
    // Ensure we start with a clean state
    resetConfig();
    const globalConfig = getConfig();
    expect(globalConfig.getNetwork()).toBe('testnet');
  });

  it('should reset global config', () => {
    // First set a custom config
    initializeConfig({
      stellar: {
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
      },
    });

    // Verify it was set
    expect(getConfig().getNetwork()).toBe('mainnet');

    // Reset and verify it's back to default
    resetConfig();
    const globalConfig = getConfig();
    expect(globalConfig.getNetwork()).toBe('testnet');
  });
});
