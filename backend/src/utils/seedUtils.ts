/**
 * Seed utility functions
 */

export interface SeedOptions {
  environment: 'development' | 'test' | 'production';
  reset: boolean;
  skipValidation: boolean;
  count: {
    users: number;
    apiKeys: number;
    apiUsage: number;
  };
}

export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  environment: 'development',
  reset: false,
  skipValidation: false,
  count: {
    users: 50,
    apiKeys: 100,
    apiUsage: 500,
  },
};

export function getSeedOptions(): SeedOptions {
  const env = (process.env.NODE_ENV as SeedOptions['environment']) || 'development';
  
  return {
    environment: env,
    reset: process.env.SEED_RESET === 'true',
    skipValidation: process.env.SEED_SKIP_VALIDATION === 'true',
    count: {
      users: parseInt(process.env.SEED_USERS || '50', 10),
      apiKeys: parseInt(process.env.SEED_API_KEYS || '100', 10),
      apiUsage: parseInt(process.env.SEED_API_USAGE || '500', 10),
    },
  };
}

export function validateSeedOptions(options: SeedOptions): boolean {
  if (options.count.users < 0 || options.count.apiKeys < 0 || options.count.apiUsage < 0) {
    throw new Error('Seed counts must be non-negative');
  }

  if (options.count.users > 10000) {
    throw new Error('Maximum 10,000 users allowed per seed');
  }

  return true;
}

export function generateSeedMetadata(options: SeedOptions): { version: string; environment: string; timestamp: Date } {
  return {
    version: '1.0.0',
    environment: options.environment,
    timestamp: new Date(),
  };
}
