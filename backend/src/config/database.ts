import { PrismaClient } from '@prisma/client';

export const dbConfig = {
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT || '5000', 10),
    validateOnBorrow: true,
  },
  monitoring: {
    enabled: process.env.DB_MONITORING_ENABLED !== 'false',
    intervalMs: parseInt(process.env.DB_MONITOR_INTERVAL || '10000', 10),
  }
};
