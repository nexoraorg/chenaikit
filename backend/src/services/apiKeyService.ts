import { PrismaClient } from '@prisma/client';
import { ApiKey, ApiKeyCreateInput, ApiKeyUpdateInput } from '../models/ApiKey';
import { createHash, randomBytes } from 'crypto';
import { log } from '../utils/logger';

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
    try {
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
    } catch (error) {
      log.error('Failed to create API key', error as Error);
      throw new Error('Failed to create API key');
    }
  }

  /**
   * Validate an API key and return the associated key object
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    try {
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
    } catch (error) {
      log.error('Failed to validate API key', error as Error);
      return null;
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string): Promise<ApiKey | null> {
    try {
      const prismaApiKey = await this.prisma.apiKey.findUnique({
        where: { id },
      });

      return prismaApiKey ? ApiKey.fromPrisma(prismaApiKey) : null;
    } catch (error) {
      log.error('Failed to get API key by ID', error as Error);
      throw new Error('Failed to get API key');
    }
  }

  /**
   * Get all API keys for a user
   */
  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    try {
      const prismaApiKeys = await this.prisma.apiKey.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      return prismaApiKeys.map(ApiKey.fromPrisma);
    } catch (error) {
      log.error('Failed to get API keys for user', error as Error);
      throw new Error('Failed to get API keys');
    }
  }

  /**
   * Update an API key
   */
  async updateApiKey(id: string, input: ApiKeyUpdateInput): Promise<ApiKey> {
    try {
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
    } catch (error) {
      log.error('Failed to update API key', error as Error);
      throw new Error('Failed to update API key');
    }
  }

  /**
   * Deactivate an API key
   */
  async deactivateApiKey(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { isActive: false },
      });

      log.info('API key deactivated', { apiKeyId: id });
    } catch (error) {
      log.error('Failed to deactivate API key', error as Error);
      throw new Error('Failed to deactivate API key');
    }
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      log.info('API key soft-deleted', { apiKeyId: id });
    } catch (error: any) {
      log.error('Failed to delete API key', error as Error);
      throw new Error('Failed to delete API key');
    }
  }

  /**
   * Update the last used timestamp for an API key
   */
  private async updateLastUsed(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      // Don't throw here as this is not critical
      log.warn('Failed to update last used timestamp', error as Error);
    }
  }

  /**
   * Reset monthly usage for an API key
   */
  async resetUsage(id: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: {
          currentUsage: 0,
          usageResetAt: new Date(),
        },
      });

      log.info('API key usage reset', { apiKeyId: id });
    } catch (error) {
      log.error('Failed to reset API key usage', error as Error);
      throw new Error('Failed to reset API key usage');
    }
  }

  /**
   * Increment usage for an API key
   */
  async incrementUsage(id: string): Promise<void> {
    try {
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
    } catch (error) {
      log.error('Failed to increment API key usage', error as Error);
      throw new Error('Failed to increment API key usage');
    }
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
    try {
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

      const totalCount = await this.prisma.apiUsage.count({ where: whereClause });
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

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
        topEndpoints: endpointCounts.map(item => ({
          endpoint: item.endpoint,
          count: item._count,
        })),
        dailyUsage: dailyCounts.map(item => ({
          date: item.date,
          requests: Number(item.requests),
        })),
      };
    } catch (error) {
      log.error('Failed to get API key usage', error as Error);
      throw new Error('Failed to get API key usage');
    }
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
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
    } catch (error) {
      log.error('Failed to cleanup expired API keys', error as Error);
      throw new Error('Failed to cleanup expired API keys');
    }
  }
}
