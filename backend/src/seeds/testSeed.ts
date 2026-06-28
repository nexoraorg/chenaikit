import { Prisma } from '@prisma/client';
import { createUserFactory, createApiKeyFactory, createApiUsageFactory } from '../factories';

export interface TestSeedData {
  users: Prisma.UserCreateManyInput[];
  apiKeys: Prisma.ApiKeyCreateManyInput[];
  apiUsage: Prisma.ApiUsageCreateManyInput[];
}

export async function generateTestSeed(options: {
  userCount?: number;
  apiKeyCount?: number;
  usageCount?: number;
}): Promise<TestSeedData> {
  const { userCount = 10, apiKeyCount = 20, usageCount = 100 } = options;

  console.log(`[seed:test] Generating ${userCount} test users...`);
  const users = createUserFactory({ 
    count: userCount,
    email: undefined // Use random emails
  });

  console.log(`[seed:test] Generating ${apiKeyCount} test API keys...`);
  const { apiKeys } = createApiKeyFactory({ 
    count: apiKeyCount,
  });

  console.log(`[seed:test] Generating ${usageCount} test API usage records...`);
  const apiUsage: Prisma.ApiUsageCreateManyInput[] = [];
  
  // Create usage for each API key
  const usagePerKey = Math.ceil(usageCount / apiKeyCount);
  for (let i = 0; i < apiKeyCount && apiUsage.length < usageCount; i++) {
    const batchSize = Math.min(usagePerKey, usageCount - apiUsage.length);
    const usage = createApiUsageFactory({ 
      count: batchSize,
      daysBack: 7 // Only last 7 days for tests
    });
    apiUsage.push(...usage);
  }

  return {
    users,
    apiKeys,
    apiUsage: apiUsage.slice(0, usageCount),
  };
}

export async function seedTest(prisma: Prisma.Client, options: { 
  reset?: boolean; 
  userCount?: number; 
  apiKeyCount?: number; 
  usageCount?: number; 
}): Promise<void> {
  const { reset = true, userCount, apiKeyCount, usageCount } = options;

  // Always reset for test environment
  if (reset) {
    console.log('[seed:test] Resetting database...');
    await prisma.apiUsage.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  }

  console.log('[seed:test] Generating test seed data...');
  const seedData = await generateTestSeed({ userCount, apiKeyCount, usageCount });

  console.log(`[seed:test] Inserting ${seedData.users.length} users...`);
  for (const user of seedData.users) {
    await prisma.user.create({
      data: user,
    });
  }

  console.log(`[seed:test] Inserting ${seedData.apiKeys.length} API keys...`);
  for (const apiKey of seedData.apiKeys) {
    await prisma.apiKey.create({
      data: apiKey,
    });
  }

  console.log(`[seed:test] Inserting ${seedData.apiUsage.length} usage records...`);
  
  const batchSize = 50;
  for (let i = 0; i < seedData.apiUsage.length; i += batchSize) {
    const batch = seedData.apiUsage.slice(i, i + batchSize);
    await prisma.apiUsage.createMany({ data: batch });
  }

  console.log('[seed:test] Test seed completed successfully!');
}
