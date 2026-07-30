import { PrismaClient } from '@prisma/client';

export class PoolUtils {
  /**
   * Checks the health of the database connection by running a simple query.
   */
  static async checkConnection(prisma: PrismaClient): Promise<boolean> {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }

  /**
   * Returns current pool configuration injected via env or database config.
   */
  static getPoolConfig() {
    return {
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '10', 10),
    };
  }

  /**
   * Simulates pool draining by disconnecting and reconnecting the Prisma client.
   * This handles connection leaks and forces a pool recreation.
   */
  static async recreatePool(prisma: PrismaClient): Promise<void> {
    console.log('Draining database connection pool...');
    await prisma.$disconnect();
    console.log('Recreating database connection pool...');
    await prisma.$connect();
    console.log('Database pool recreated successfully.');
  }
}
