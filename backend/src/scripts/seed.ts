#!/usr/bin/env node

/**
 * Database Seeding CLI Script
 * 
 * Usage:
 *   ts-node src/scripts/seed.ts seed:dev
 *   ts-node src/scripts/seed.ts seed:test
 *   ts-node src/scripts/seed.ts seed:prod
 *   ts-node src/scripts/seed.ts seed:reset
 *   ts-node src/scripts/seed.ts seed:validate
 */

import { PrismaClient } from '@prisma/client';
import { seedDevelopment, seedTest, seedProduction } from '../seeds';
import { getSeedOptions, validateSeedOptions } from '../utils/seedUtils';

const prisma = new PrismaClient();

async function main() {
  const command = process.argv[2] || 'seed:dev';
  
  console.log(`\n🌱 Running seed command: ${command}\n`);

  try {
    switch (command) {
      case 'seed:dev': {
        const options = getSeedOptions();
        validateSeedOptions(options);
        
        console.log(`Users: ${options.count.users}, API Keys: ${options.count.apiKeys}, Usage: ${options.count.apiUsage}`);
        
        await seedDevelopment(prisma, {
          reset: options.reset,
          userCount: options.count.users,
          apiKeyCount: options.count.apiKeys,
          usageCount: options.count.apiUsage,
        });
        break;
      }

      case 'seed:test': {
        const options = getSeedOptions();
        
        console.log(`Users: ${options.count.users}, API Keys: ${options.count.apiKeys}, Usage: ${options.count.apiUsage}`);
        
        await seedTest(prisma, {
          reset: true,
          userCount: Math.min(options.count.users, 10),
          apiKeyCount: Math.min(options.count.apiKeys, 20),
          usageCount: Math.min(options.count.apiUsage, 100),
        });
        break;
      }

      case 'seed:prod': {
        const adminEmail = process.env.SEED_ADMIN_EMAIL;
        const adminPassword = process.env.SEED_ADMIN_PASSWORD;
        const apiKeyName = process.env.SEED_ADMIN_API_KEY_NAME || 'Default Admin Key';

        if (!adminEmail || !adminPassword) {
          console.error('❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD required for production seed');
          process.exit(1);
        }

        await seedProduction(prisma, {
          adminEmail,
          adminPassword,
          apiKeyName,
        });
        break;
      }

      case 'seed:reset': {
        console.log('Resetting development database...');
        const options = getSeedOptions();
        
        await seedDevelopment(prisma, {
          reset: true,
          userCount: options.count.users,
          apiKeyCount: options.count.apiKeys,
          usageCount: options.count.apiUsage,
        });
        break;
      }

      case 'seed:validate': {
        console.log('Validating seed data...');
        const userCount = await prisma.user.count();
        const apiKeyCount = await prisma.apiKey.count();
        const usageCount = await prisma.apiUsage.count();
        
        console.log(`Users: ${userCount}, API Keys: ${apiKeyCount}, Usage: ${usageCount}`);
        
        const apiKeysWithUsers = await prisma.apiKey.count({
          where: { userId: { not: null } }
        });
        console.log(`API Keys with users: ${apiKeysWithUsers}`);
        
        const orphanedUsage = await prisma.apiUsage.count({
          where: { apiKeyId: null } as any
        });
        
        if (orphanedUsage > 0) {
          console.warn(`⚠️  ${orphanedUsage} usage records without API keys`);
        }
        
        console.log('✅ Validation completed');
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands: seed:dev, seed:test, seed:prod, seed:reset, seed:validate');
        process.exit(1);
    }

    console.log('✅ Seed completed successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
