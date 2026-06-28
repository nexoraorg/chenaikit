import { PrismaClient, Prisma } from '@prisma/client';
import { createUserFactory, createApiKeyFactory } from '../factories';

export async function seedProduction(prisma: PrismaClient, options: { 
  adminEmail?: string;
  adminPassword?: string;
  apiKeyName?: string;
}): Promise<void> {
  const { adminEmail, adminPassword, apiKeyName } = options;

  console.log('[seed:prod] Seeding production data...');

  if (!adminEmail || !adminPassword) {
    throw new Error('Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
  }

  // Create admin user
  console.log(`[seed:prod] Creating admin user: ${adminEmail}`);
  const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash(adminPassword, 12));
  
  let user = await prisma.user.findFirst({
    where: { email: adminEmail } as any,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      },
    });
  }

  // Create admin API key
  if (apiKeyName) {
    const { randomBytes, createHash } = await import('crypto');
    const plainApiKey = randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(plainApiKey).digest('hex');
    
    console.log(`[seed:prod] Creating API key: ${apiKeyName}`);
    
    let apiKey = await prisma.apiKey.findFirst({
      where: { keyHash } as any,
    });

    if (!apiKey) {
      apiKey = await prisma.apiKey.create({
        data: {
          keyHash,
          name: apiKeyName,
          tier: 'ENTERPRISE',
          userId: user.id,
          isActive: true,
          allowedIps: '[]',
          allowedPaths: '[]',
        },
      });
    }

    if (process.env.SEED_LOG_SECRETS_LOCAL === 'true') {
      console.warn(`[seed:prod] Admin API Key (store securely): ${plainApiKey}`);
    }
  }

  // Create sample regular users (minimal for production)
  console.log('[seed:prod] Creating sample regular users...');
  const sampleUsers = createUserFactory({ 
    count: 5,
    role: 'user'
  });

  for (const userData of sampleUsers) {
    const hashedUserPassword = await import('bcrypt').then(bcrypt => bcrypt.hash(userData.password, 12));
    
    let existingUser = await prisma.user.findFirst({
      where: { email: userData.email } as any,
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          ...userData,
          password: hashedUserPassword,
        },
      });
    }
  }

  console.log('[seed:prod] Production seed completed successfully!');
}
