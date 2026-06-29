import { PrismaClient, Prisma } from '@prisma/client';
import { createUserFactory, createApiKeyFactory, createApiUsageFactory } from '../factories';

export interface DevelopmentSeedData {
  users: Prisma.UserCreateManyInput[];
  apiKeys: Prisma.ApiKeyCreateManyInput[];
  apiUsage: Prisma.ApiUsageCreateManyInput[];
}

export async function generateDevelopmentSeed(options: {
  userCount?: number;
  apiKeyCount?: number;
  usageCount?: number;
}): Promise<DevelopmentSeedData> {
  const { userCount = 50, apiKeyCount = 100, usageCount = 500 } = options;

  console.log(`[seed:dev] Generating ${userCount} users...`);
  const users = createUserFactory({ count: userCount });

  console.log(`[seed:dev] Generating ${apiKeyCount} API keys...`);
  const { apiKeys } = createApiKeyFactory({ 
    count: apiKeyCount,
  });

  console.log(`[seed:dev] Generating ${usageCount} API usage records...`);
  const apiUsage: Prisma.ApiUsageCreateManyInput[] = [];
  
  // Distribute usage across all API keys
  const usagePerKey = Math.ceil(usageCount / apiKeyCount);
  for (let i = 0; i < apiKeyCount && apiUsage.length < usageCount; i++) {
    const batchSize = Math.min(usagePerKey, usageCount - apiUsage.length);
    const usage = createApiUsageFactory({ 
      count: batchSize,
      daysBack: 30
    });
    apiUsage.push(...usage);
  }

  return {
    users,
    apiKeys,
    apiUsage: apiUsage.slice(0, usageCount),
  };
}

export async function seedDevelopment(prisma: PrismaClient, options: { 
  reset?: boolean; 
  userCount?: number; 
  apiKeyCount?: number; 
  usageCount?: number; 
}): Promise<void> {
  const { reset = false, userCount, apiKeyCount, usageCount } = options;

  if (reset) {
    console.log('[seed:dev] Resetting database...');
    await prisma.apiUsage.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  }

  console.log('[seed:dev] Generating seed data...');
  const seedData = await generateDevelopmentSeed({ userCount, apiKeyCount, usageCount });

  console.log(`[seed:dev] Inserting ${seedData.users.length} users...`);
  for (const user of seedData.users) {
    await prisma.user.upsert({
      where: { id: user.id } as any,
      update: {},
      create: user,
    });
  }

  console.log(`[seed:dev] Inserting ${seedData.apiKeys.length} API keys...`);
  for (const apiKey of seedData.apiKeys) {
    await prisma.apiKey.upsert({
      where: { keyHash: apiKey.keyHash },
      update: {},
      create: apiKey,
    });
  }

  console.log(`[seed:dev] Inserting ${seedData.apiUsage.length} usage records...`);
  
  // Batch insert for better performance
  const batchSize = 100;
  for (let i = 0; i < seedData.apiUsage.length; i += batchSize) {
    const batch = seedData.apiUsage.slice(i, i + batchSize);
    await prisma.apiUsage.createMany({ data: batch });
    console.log(`[seed:dev] Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(seedData.apiUsage.length / batchSize)}`);
  }

  console.log('[seed:dev] Development seed completed successfully!');
}
