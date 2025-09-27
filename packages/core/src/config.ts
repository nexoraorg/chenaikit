/**
 * Configuration management for ChenAIKit
 */

import { ChenAIKitConfig, ChenAIKitError, ValidationError } from './types';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<ChenAIKitConfig> = {
  stellar: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  ai: {
    apiBaseUrl: 'https://api.chenaikit.com',
    timeout: 30000, // 30 seconds
  },
  cache: {
    ttl: 300, // 5 minutes
    enabled: true,
  },
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: ChenAIKitConfig;

  constructor(initialConfig?: Partial<ChenAIKitConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, initialConfig);
    this.validateConfig();
  }

  /**
   * Get the current configuration
   */
  getConfig(): ChenAIKitConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ChenAIKitConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig();
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof ChenAIKitConfig>(key: K): ChenAIKitConfig[K] {
    return this.config[key];
  }

  /**
   * Set a specific configuration value
   */
  set<K extends keyof ChenAIKitConfig>(key: K, value: ChenAIKitConfig[K]): void {
    this.config[key] = value;
    this.validateConfig();
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Get the current network (testnet/mainnet)
   */
  getNetwork(): 'testnet' | 'mainnet' {
    return this.config.stellar.network;
  }

  /**
   * Check if using testnet
   */
  isTestnet(): boolean {
    return this.config.stellar.network === 'testnet';
  }

  /**
   * Check if using mainnet
   */
  isMainnet(): boolean {
    return this.config.stellar.network === 'mainnet';
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(
    base: Partial<ChenAIKitConfig>,
    updates?: Partial<ChenAIKitConfig>
  ): ChenAIKitConfig {
    if (!updates) {
      return base as ChenAIKitConfig;
    }

    return {
      stellar: { ...base.stellar, ...updates.stellar },
      ai: { ...base.ai, ...updates.ai },
      cache: { ...base.cache, ...updates.cache },
    } as ChenAIKitConfig;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const errors: string[] = [];

    // Validate Stellar config
    if (!this.config.stellar?.horizonUrl) {
      errors.push('Stellar horizon URL is required');
    }

    if (!['testnet', 'mainnet'].includes(this.config.stellar?.network || '')) {
      errors.push('Stellar network must be either "testnet" or "mainnet"');
    }

    // Validate AI config
    if (!this.config.ai?.apiBaseUrl) {
      errors.push('AI API base URL is required');
    }

    // Validate cache config
    if (this.config.cache?.ttl && this.config.cache.ttl < 0) {
      errors.push('Cache TTL must be a positive number');
    }

    if (errors.length > 0) {
      throw new ValidationError(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
}

/**
 * Global configuration instance
 */
let globalConfig: ConfigManager | null = null;

/**
 * Initialize global configuration
 */
export function initializeConfig(config?: Partial<ChenAIKitConfig>): ConfigManager {
  globalConfig = new ConfigManager(config);
  return globalConfig;
}

/**
 * Get global configuration
 */
export function getConfig(): ConfigManager {
  if (!globalConfig) {
    globalConfig = new ConfigManager();
  }
  return globalConfig;
}

/**
 * Reset global configuration
 */
export function resetConfig(): void {
  globalConfig = null;
}
