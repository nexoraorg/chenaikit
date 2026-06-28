import { randomBytes, createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface ApiKeyFactoryOptions {
  count?: number;
  userId?: string;
  name?: string;
  tier?: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export function createApiKeyFactory(options: ApiKeyFactoryOptions = {}) {
  const { count = 1, userId, name, tier } = options;

  const apiKeys: Prisma.ApiKeyCreateManyInput[] = [];
  
  for (let i = 0; i < count; i++) {
    const plainKey = randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(plainKey).digest('hex');
    
    const apiKey: Prisma.ApiKeyCreateManyInput = {
      keyHash,
      name: name || `API Key ${randomUUID().slice(0, 8)}`,
      tier: tier || randomItem(['FREE', 'PRO', 'ENTERPRISE']),
      userId: userId,
      isActive: Math.random() > 0.1, // 90% active
      allowedIps: JSON.stringify([]),
      allowedPaths: JSON.stringify(['/api/*']),
      createdAt: new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)),
      usageQuota: randomItem([1000, 5000, 10000, null]),
      currentUsage: randomInt(0, 1000),
      usageResetAt: new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000),
      deletedAt: Math.random() > 0.9 ? new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)) : null,
    };
    
    apiKeys.push(apiKey);
  }

  return { apiKeys, plainKeys: [] };
}

export function createApiKeyCreateInput(overrides: Partial<Prisma.ApiKeyCreateInput> = {}): Prisma.ApiKeyCreateInput {
  const plainKey = randomBytes(32).toString('hex');
  const keyHash = createHash('sha256').update(plainKey).digest('hex');
  
  return {
    keyHash,
    name: overrides.name || `API Key ${randomUUID().slice(0, 8)}`,
    tier: overrides.tier || 'FREE',
    userId: overrides.userId,
    isActive: overrides.isActive ?? true,
    allowedIps: overrides.allowedIps || '[]',
    allowedPaths: overrides.allowedPaths || '[]',
    expiresAt: overrides.expiresAt,
    usageQuota: overrides.usageQuota,
    currentUsage: overrides.currentUsage || 0,
    usageResetAt: overrides.usageResetAt || new Date(),
    deletedAt: overrides.deletedAt,
    ...overrides,
  };
}
