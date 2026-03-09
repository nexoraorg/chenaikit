import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcrypt'
import { randomBytes, createHash } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const isProd = process.env.NODE_ENV === 'production'
  const shouldSeedAdmin = process.env.SEED_CREATE_ADMIN === 'true'

  if (!shouldSeedAdmin) {
    console.log('[seed] Skipping admin creation (SEED_CREATE_ADMIN is not set to true).')
    return
  }

  const email = process.env.SEED_ADMIN_EMAIL
  const plainPassword = process.env.SEED_ADMIN_PASSWORD || (!isProd ? randomBytes(18).toString('base64url') : undefined)
  const plainApiKey = process.env.SEED_ADMIN_API_KEY || (!isProd ? randomBytes(32).toString('hex') : undefined)

  if (!email || !plainPassword || !plainApiKey) {
    throw new Error(
      '[seed] Missing SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD or SEED_ADMIN_API_KEY. Refusing to seed privileged account.'
    )
  }

  const passwordHash = await bcrypt.hash(plainPassword, 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email,
      password: passwordHash,
      role: 'admin'
    }
  })

  const apiKey = await prisma.apiKey.upsert({
    where: { keyHash: createHash('sha256').update(plainApiKey).digest('hex') },
    update: {},
    create: {
      keyHash: createHash('sha256').update(plainApiKey).digest('hex'),
      name: 'Default Admin Key',
      tier: 'PRO',
      userId: user.id,
      isActive: true,
      allowedIps: '[]',
      allowedPaths: '[]'
    }
  })

  const now = new Date()
  const idHealth = createHash('sha256').update(`${apiKey.id}|/v1/health|GET|seed`).digest('hex')
  const idStats = createHash('sha256').update(`${apiKey.id}|/v1/stats|GET|seed`).digest('hex')

  await prisma.apiUsage.upsert({
    where: { id: idHealth },
    update: {},
    create: {
      id: idHealth,
      apiKeyId: apiKey.id,
      endpoint: '/v1/health',
      method: 'GET',
      statusCode: 200,
      responseTime: 45,
      requestSize: 0,
      responseSize: 64,
      ip: '127.0.0.1',
      userAgent: 'seed/1.0',
      timestamp: now
    }
  })
  await prisma.apiUsage.upsert({
    where: { id: idStats },
    update: {},
    create: {
      id: idStats,
      apiKeyId: apiKey.id,
      endpoint: '/v1/stats',
      method: 'GET',
      statusCode: 200,
      responseTime: 78,
      requestSize: 0,
      responseSize: 128,
      ip: '127.0.0.1',
      userAgent: 'seed/1.0',
      timestamp: now
    }
  })

  if (!isProd) {
    console.warn('[seed] Admin seeded for local development only.')
    console.warn(`[seed] Email: ${email}`)
    console.warn(`[seed] Temporary Password: ${plainPassword}`)
    console.warn(`[seed] Admin API Key (store securely, shown once): ${plainApiKey}`)
  } else {
    console.log('[seed] Admin seeded with provided environment secrets.')
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
