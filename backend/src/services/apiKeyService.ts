import { PrismaClient } from '@prisma/client';
import { ApiKey, ApiKeyCreateInput, ApiKeyUpdateInput } from '../models/ApiKey';
import { createHash, randomBytes } from 'crypto';
import { log } from '../utils/logger';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';

export class ApiKeyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a new API key and hash it for storage
   */
  private generateApiKey(): { key: string; hash: string } {
    const key = `ck_${randomBytes(32).toString('hex')}`;
    const hash = createHash('sha256').update(key).digest('hex');
    return { key, hash };
  }

  /**
   * Create a new API key
   */
  async createApiKey(input: ApiKeyCreateInput): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const { key, hash } = this.generateApiKey();
    
    const prismaApiKey = await this.prisma.apiKey.create({
      data: {
        keyHash: hash,
        name: input.name,
        tier: input.tier || 'FREE',
        userId: input.userId || undefined,
        allowedIps: JSON.stringify(input.allowedIps || []),
        allowedPaths: JSON.stringify(input.allowedPaths || []),
        expiresAt: input.expiresAt,
        usageQuota: input.usageQuota,
      },
    });

    const apiKey = ApiKey.fromPrisma(prismaApiKey);
    
    log.info('API key created', {
      apiKeyId: apiKey.id,
      name: apiKey.name,
      tier: apiKey.tier,
      userId: apiKey.userId || undefined,
    });

    return { apiKey, plainKey: key };
  }

  /**
   * Validate an API key and return the associated key object
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    const hash = createHash('sha256').update(key).digest('hex');
    
    const prismaApiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: hash,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!prismaApiKey) {
      return null;
    }

    const apiKey = ApiKey.fromPrisma(prismaApiKey);

    // Check if key is expired
    if (apiKey.isExpired()) {
      await this.deactivateApiKey(apiKey.id);
      return null;
    }

    // Update last used timestamp
    await this.updateLastUsed(apiKey.id);

    return apiKey;
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string): Promise<ApiKey | null> {
    const prismaApiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    return prismaApiKey ? ApiKey.fromPrisma(prismaApiKey) : null;
  }

  /**
   * Get all API keys for a user
   */
  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    const prismaApiKeys = await this.prisma.apiKey.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return prismaApiKeys.map(ApiKey.fromPrisma);
  }

  /**
   * Update an API key
   */
  async updateApiKey(id: string, input: ApiKeyUpdateInput): Promise<ApiKey> {
    const prismaApiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.tier && { tier: input.tier }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.allowedIps && { allowedIps: JSON.stringify(input.allowedIps) }),
        ...(input.allowedPaths && { allowedPaths: JSON.stringify(input.allowedPaths) }),
        ...(input.expiresAt && { expiresAt: input.expiresAt }),
        ...(input.usageQuota && { usageQuota: input.usageQuota }),
      },
    });

    const apiKey = ApiKey.fromPrisma(prismaApiKey);
    
    log.info('API key updated', {
      apiKeyId: apiKey.id,
      name: apiKey.name,
    });

    return apiKey;
  }

  /**
   * Deactivate an API key
   */
  async deactivateApiKey(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    log.info('API key deactivated', { apiKeyId: id });
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    log.info('API key soft-deleted', { apiKeyId: id });
  }

  /**
   * Update the last used timestamp for an API key
   */
  private async updateLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Reset monthly usage for an API key
   */
  async resetUsage(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        currentUsage: 0,
        usageResetAt: new Date(),
      },
    });

    log.info('API key usage reset', { apiKeyId: id });
  }

  /**
   * Increment usage for an API key
   */
  async incrementUsage(id: string): Promise<void> {
    const apiKey = await this.getApiKeyById(id);
    if (!apiKey) return;

    // Reset usage if needed (monthly reset)
    if (apiKey.needsQuotaReset()) {
      await this.resetUsage(id);
      return;
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: {
        currentUsage: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get usage statistics for an API key
   */
  async getApiKeyUsage(id: string, startDate?: Date, endDate?: Date): Promise<{
    totalRequests: number;
    requestsThisMonth: number;
    averageResponseTime: number;
    successRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    dailyUsage: Array<{ date: string; requests: number }>;
  }> {
    const whereClause: Record<string, any> = { apiKeyId: id };
    
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp.gte = startDate;
      if (endDate) whereClause.timestamp.lte = endDate;
    }

    const [totalRequests, avgResponseTime, successCount, endpointCounts, dailyCounts] = await Promise.all([
      this.prisma.apiUsage.count({ where: whereClause }),
      this.prisma.apiUsage.aggregate({
        where: whereClause,
        _avg: { responseTime: true },
      }),
      this.prisma.apiUsage.count({
        where: { ...whereClause, statusCode: { lt: 400 } },
      }),
      this.prisma.apiUsage.groupBy({
        by: ['endpoint'],
        where: whereClause,
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
        take: 10,
      }),
      this.prisma.$queryRaw<Array<{ date: string; requests: bigint }>>`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as requests
        FROM api_usage 
        WHERE api_key_id = ${id}
          AND timestamp >= datetime('now', '-30 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `,
    ]);

    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

    // Get current month usage
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const requestsThisMonth = await this.prisma.apiUsage.count({
      where: {
        apiKeyId: id,
        timestamp: { gte: currentMonthStart },
      },
    });

    return {
      totalRequests,
      requestsThisMonth,
      averageResponseTime: avgResponseTime._avg.responseTime || 0,
      successRate,
      topEndpoints: endpointCounts.map((item: any) => ({
        endpoint: item.endpoint,
        count: item._count,
      })),
      dailyUsage: (dailyCounts as any[]).map((item: any) => ({
        date: item.date,
        requests: Number(item.requests),
      })),
    };
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.prisma.apiKey.updateMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    log.info('Cleaned up expired API keys', { count: result.count });
    return result.count;
  }
}
