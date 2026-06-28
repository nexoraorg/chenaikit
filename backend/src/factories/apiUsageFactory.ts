import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface ApiUsageFactoryOptions {
  count?: number;
  apiKeyId?: string;
  daysBack?: number;
}

export function createApiUsageFactory(options: ApiUsageFactoryOptions = {}) {
  const { count = 1, apiKeyId, daysBack = 30 } = options;

  const usageRecords: Prisma.ApiUsageCreateManyInput[] = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysBack);
  
  const endpoints = ['/api/v1/users', '/api/v1/transactions', '/api/v1/analytics', '/api/v1/health', '/api/v1/stats'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const userAgents = [
    'Mozilla/5.0 (Windows)',
    'Mozilla/5.0 (Macintosh)',
    'PostmanRuntime/7.32.3',
    'curl/8.1.2',
    'python-requests/2.31.0'
  ];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    
    const usage: Prisma.ApiUsageCreateManyInput = {
      apiKeyId: apiKeyId || randomUUID(),
      endpoint: randomItem(endpoints),
      method: randomItem(methods),
      statusCode: randomItem([200, 200, 200, 201, 400, 401, 403, 404, 500]),
      responseTime: randomInt(10, 2000),
      requestSize: randomInt(0, 10000),
      responseSize: randomInt(100, 50000),
      ip: `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`,
      userAgent: randomItem(userAgents),
      timestamp,
      updatedAt: timestamp,
      deletedAt: Math.random() > 0.95 ? new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)) : null,
    };
    
    usageRecords.push(usage);
  }

  return usageRecords;
}

export function createApiUsageCreateInput(overrides: Partial<Prisma.ApiUsageCreateInput> = {}): Prisma.ApiUsageCreateInput {
  return {
    apiKeyId: overrides.apiKeyId || randomUUID(),
    endpoint: overrides.endpoint || '/api/v1/users',
    method: overrides.method || 'GET',
    statusCode: overrides.statusCode || 200,
    responseTime: overrides.responseTime || randomInt(10, 1000),
    requestSize: overrides.requestSize || randomInt(0, 1000),
    responseSize: overrides.responseSize || randomInt(100, 5000),
    ip: overrides.ip || '127.0.0.1',
    userAgent: overrides.userAgent || 'test-agent',
    timestamp: overrides.timestamp || new Date(),
    deletedAt: overrides.deletedAt,
    ...overrides,
  };
}
