import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const password = 'Admin123!@#'
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      role: 'admin'
    }
  })

  const apiKey = await prisma.apiKey.upsert({
    where: { keyHash: 'seeded-key-hash' },
    update: {},
    create: {
      keyHash: 'seeded-key-hash',
      name: 'Default Admin Key',
      tier: 'PRO',
      userId: user.id,
      isActive: true,
      allowedIps: '[]',
      allowedPaths: '[]'
    }
  })

  const now = new Date()
  await prisma.apiUsage.createMany({
    data: [
      {
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
      },
      {
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
    ]
  })
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
