import { PrismaClient } from '../generated/prisma';

export const prisma = new PrismaClient();

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
