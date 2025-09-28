/**
 * ChenAIKit Core SDK
 * 
 * A TypeScript toolkit for building AI-powered blockchain applications.
 * Provides integrations with Stellar blockchain and AI services for
 * gamified learning experiences.
 */

// Core exports
export * from './types';
export * from './config';
export * from './client';

// Stellar blockchain integration
export * from './stellar';

// AI services integration
export * from './ai';

// Utility functions
export * from './utils';

// Main classes (from main branch)
export { StellarConnector } from './stellar/connector';
export { AIService } from './ai/service';
export { CreditScorer } from './ai/credit-scorer';
export { FraudDetector } from './ai/fraud-detector';

// Version information
export const VERSION = '0.1.0';

/**
 * Default configuration for ChenAIKit
 */
export const DEFAULT_CONFIG = {
  stellar: {
    network: 'testnet' as const,
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  ai: {
    apiBaseUrl: 'https://api.chenaikit.com',
  },
  cache: {
    ttl: 300, // 5 minutes
  },
} as const;
