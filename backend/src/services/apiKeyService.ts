import { PrismaClient } from '@prisma/client';
import { ApiKey, ApiKeyCreateInput, ApiKeyUpdateInput, ApiKeyStatus, ApiKeyUsage } from '../models/ApiKey';
import { log } from '../utils/logger';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import { generateApiKey, verifyApiKey } from '../utils/keyUtils';

export class ApiKeyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new API key
   */
  async createApiKey(input: ApiKeyCreateInput): Promise<{ apiKey: ApiKey; plainKey: string }> {
    const prefix = input.type === 'TEMPORARY' ? 'ak_test_' : 'ak_live_';
    const { key, hash, publicId } = await generateApiKey(prefix);
    
    const prismaApiKey = await this.prisma.apiKey.create({
      data: {
        keyHash: hash,
        publicId: publicId,
        name: input.name,
        prefix: prefix,
        type: input.type || 'READ_WRITE',
        status: 'ACTIVE',
        tier: input.tier || 'FREE',
        userId: input.userId || undefined,
        allowedIps: JSON.stringify(input.allowedIps || []),
        allowedPaths: JSON.stringify(input.allowedPaths || []),
        permissions: JSON.stringify(input.permissions || []),
        scopes: JSON.stringify(input.scopes || []),
        expiresAt: input.expiresAt,
        usageQuota: input.usageQuota,
      },
    });

    const apiKey = ApiKey.fromPrisma(prismaApiKey);
    
    await this.createAuditLog(apiKey.id, 'CREATED', { name: apiKey.name, tier: apiKey.tier }, apiKey.userId || undefined);

    log.info('API key created', {
      apiKeyId: apiKey.id,
      name: apiKey.name,
      tier: apiKey.tier,
      userId: apiKey.userId || undefined,
    });

    return { apiKey, plainKey: key };
  }

  /**
   * Create an audit log entry
   */
  private async createAuditLog(entityId: string, action: string, metadata: any, userId?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'ApiKey',
          entityId,
          action,
          metadata: JSON.stringify(metadata),
          userId,
        },
      });
    } catch (error) {
      log.error('Failed to create audit log', { error: error as Error, entityId, action });
    }
  }

  /**
   * Validate an API key and return the associated key object
   * This is optimized for performance as it's called on every request.
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    // Format: prefix_publicId_secretPart
    const parts = key.split('_');
    if (parts.length < 3) return null;
    
    const prefix = `${parts[0]}_${parts[1]}_`;
    const publicId = parts[2];

    // Find the key by publicId (optimized lookup)
    const prismaApiKey = await this.prisma.apiKey.findUnique({
      where: {
        publicId: publicId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!prismaApiKey || prismaApiKey.status !== 'ACTIVE') {
      return null;
    }

    if (await verifyApiKey(key, prismaApiKey.keyHash)) {
      const apiKey = ApiKey.fromPrisma(prismaApiKey);

      // Check if key is expired
      if (apiKey.isExpired()) {
        await this.updateApiKeyStatus(apiKey.id, 'EXPIRED');
        return null;
      }

      // Update last used timestamp
      await this.updateLastUsed(apiKey.id);

      return apiKey;
    }

    return null;
  }

  /**
    * Rotate an API key
    */
   async rotateApiKey(id: string): Promise<{ apiKey: ApiKey; plainKey: string }> {
     const oldKey = await this.getApiKeyById(id);
     if (!oldKey) throw new NotFoundError('API key not found');
 
     // Create a new key with same properties
    const { apiKey: newKey, plainKey } = await this.createApiKey({
      name: `${oldKey.name} (Rotated)`,
      tier: oldKey.tier,
      type: oldKey.type,
      userId: oldKey.userId || undefined,
      allowedIps: oldKey.allowedIps,
      allowedPaths: oldKey.allowedPaths,
      permissions: oldKey.permissions,
      scopes: oldKey.scopes,
      expiresAt: oldKey.expiresAt || undefined,
      usageQuota: oldKey.usageQuota || undefined,
    });
 
    // Update new key to show it was rotated from old one
    await this.prisma.apiKey.update({
      where: { id: newKey.id },
      data: { rotatedFrom: oldKey.id },
    });
 
     // Revoke the old key
     await this.revokeApiKey(oldKey.id);

     await this.createAuditLog(oldKey.id, 'ROTATED', { newKeyId: newKey.id }, oldKey.userId || undefined);
 
     log.info('API key rotated', { oldKeyId: oldKey.id, newKeyId: newKey.id });
 
     return { apiKey: newKey, plainKey };
   }
 
   /**
    * Revoke an API key
    */
   async revokeApiKey(id: string): Promise<void> {
     const apiKey = await this.getApiKeyById(id);
     await this.updateApiKeyStatus(id, 'REVOKED');
     if (apiKey) {
       await this.createAuditLog(id, 'REVOKED', {}, apiKey.userId || undefined);
     }
     log.info('API key revoked', { apiKeyId: id });
   }
 
   /**
    * Reactivate an API key
    */
   async reactivateApiKey(id: string): Promise<void> {
     const apiKey = await this.getApiKeyById(id);
     await this.updateApiKeyStatus(id, 'ACTIVE');
     if (apiKey) {
       await this.createAuditLog(id, 'REACTIVATED', {}, apiKey.userId || undefined);
     }
     log.info('API key reactivated', { apiKeyId: id });
   }

  /**
   * Update API key status
   */
  private async updateApiKeyStatus(id: string, status: ApiKeyStatus): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { 
        status,
        isActive: status === 'ACTIVE'
      },
    });
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
        ...(input.type && { type: input.type }),
        ...(input.status && { status: input.status, isActive: input.status === 'ACTIVE' }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.allowedIps && { allowedIps: JSON.stringify(input.allowedIps) }),
        ...(input.allowedPaths && { allowedPaths: JSON.stringify(input.allowedPaths) }),
        ...(input.permissions && { permissions: JSON.stringify(input.permissions) }),
        ...(input.scopes && { scopes: JSON.stringify(input.scopes) }),
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
   * Deactivate an API key (Soft)
   */
  async deactivateApiKey(id: string): Promise<void> {
    await this.updateApiKeyStatus(id, 'INACTIVE');
  }

  /**
   * Delete an API key (Soft delete)
   */
  async deleteApiKey(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        status: 'REVOKED',
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
        usageCount: 0,
        usageResetAt: new Date(),
      },
    });

    log.info('API key usage reset', { apiKeyId: id });
  }

  /**
   * Record usage for an API key
   */
  async recordUsage(id: string, success: boolean): Promise<void> {
    const apiKey = await this.getApiKeyById(id);
    if (!apiKey) return;

    // Reset usage if needed (monthly reset)
    if (apiKey.needsQuotaReset()) {
      await this.resetUsage(id);
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
      },
    });
  }

  /**
   * Get usage statistics for an API key
   */
  async getApiKeyUsage(id: string, startDate?: Date, endDate?: Date): Promise<ApiKeyUsage> {
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
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        isActive: false,
      },
    });

    log.info('Cleaned up expired API keys', { count: result.count });
    return result.count;
  }
}
