import { Request, Response } from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { prisma } from '../prisma/client';
import {
   CreateApiKeyBody,
   UpdateApiKeyBody,
   RotateApiKeyBody,
} from '../schemas/apiKey.schema';
import { NotFoundError, ValidationError } from '../utils/errors';

const apiKeyService = new ApiKeyService(prisma);

export class ApiKeyController {
   static async createApiKey(req: Request, res: Response) {
      const input: CreateApiKeyBody = req.body;

      const { apiKey, plainKey } = await apiKeyService.createApiKey(input);

      res.status(201).json({
         success: true,
         data: {
            id: apiKey.id,
            name: apiKey.name,
            tier: apiKey.tier,
            key: plainKey,
            allowedIps: apiKey.allowedIps,
            allowedPaths: apiKey.allowedPaths,
            expiresAt: apiKey.expiresAt,
            usageQuota: apiKey.usageQuota,
            createdAt: apiKey.createdAt,
         },
         message: 'API key created. Save the key securely — it will not be shown again.',
      });
   }

   static async getApiKey(req: Request, res: Response) {
      const { id } = req.params;

      const apiKey = await apiKeyService.getApiKeyById(id);
      if (!apiKey) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      res.json({
         success: true,
         data: {
            id: apiKey.id,
            name: apiKey.name,
            tier: apiKey.tier,
            userId: apiKey.userId,
            isActive: apiKey.isActive,
            allowedIps: apiKey.allowedIps,
            allowedPaths: apiKey.allowedPaths,
            expiresAt: apiKey.expiresAt,
            lastUsedAt: apiKey.lastUsedAt,
            usageQuota: apiKey.usageQuota,
            currentUsage: apiKey.currentUsage,
            createdAt: apiKey.createdAt,
         },
      });
   }

   static async listApiKeys(req: Request, res: Response) {
      const { page = 1, limit = 20, tier, isActive } = req.query as any;

      const where: any = { deletedAt: null };
      if (tier) where.tier = tier;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [keys, total] = await Promise.all([
         prisma.apiKey.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
         }),
         prisma.apiKey.count({ where }),
      ]);

      res.json({
         success: true,
         data: keys.map((k) => ({
            id: k.id,
            name: k.name,
            tier: k.tier,
            isActive: k.isActive,
            expiresAt: k.expiresAt,
            lastUsedAt: k.lastUsedAt,
            currentUsage: k.currentUsage,
            usageQuota: k.usageQuota,
            createdAt: k.createdAt,
         })),
         pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
         },
      });
   }

   static async updateApiKey(req: Request, res: Response) {
      const { id } = req.params;
      const input: UpdateApiKeyBody = req.body;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      const updated = await apiKeyService.updateApiKey(id, input);

      res.json({
         success: true,
         data: {
            id: updated.id,
            name: updated.name,
            tier: updated.tier,
            isActive: updated.isActive,
            allowedIps: updated.allowedIps,
            allowedPaths: updated.allowedPaths,
            expiresAt: updated.expiresAt,
            usageQuota: updated.usageQuota,
         },
      });
   }

   static async deactivateApiKey(req: Request, res: Response) {
      const { id } = req.params;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      await apiKeyService.deactivateApiKey(id);

      res.json({
         success: true,
         message: 'API key deactivated',
      });
   }

   static async deleteApiKey(req: Request, res: Response) {
      const { id } = req.params;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      await apiKeyService.deleteApiKey(id);

      res.json({
         success: true,
         message: 'API key deleted',
      });
   }

   static async getApiKeyUsage(req: Request, res: Response) {
      const { id } = req.params;
      const { startDate, endDate } = req.query as any;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      const usage = await apiKeyService.getApiKeyUsage(
         id,
         startDate ? new Date(startDate) : undefined,
         endDate ? new Date(endDate) : undefined
      );

      res.json({
         success: true,
         data: usage,
      });
   }

   static async resetApiKeyUsage(req: Request, res: Response) {
      const { id } = req.params;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      await apiKeyService.resetUsage(id);

      res.json({
         success: true,
         message: 'API key usage reset',
      });
   }

   static async rotateApiKey(req: Request, res: Response) {
      const { id } = req.params;
      const input: RotateApiKeyBody = req.body;

      const existing = await apiKeyService.getApiKeyById(id);
      if (!existing) {
         throw new NotFoundError('API key not found', { apiKeyId: id });
      }

      // Deactivate old key
      await apiKeyService.deactivateApiKey(id);

      // Create new key with same settings (rotated)
      const { apiKey: newKey, plainKey } = await apiKeyService.createApiKey({
         name: input.name || existing.name,
         tier: input.tier || existing.tier,
         userId: existing.userId || undefined,
         allowedIps: input.allowedIps || existing.allowedIps,
         allowedPaths: input.allowedPaths || existing.allowedPaths,
         expiresAt: input.expiresAt ? new Date(input.expiresAt) : existing.expiresAt,
         usageQuota: input.usageQuota || existing.usageQuota,
      });

      res.json({
         success: true,
         data: {
            id: newKey.id,
            name: newKey.name,
            tier: newKey.tier,
            key: plainKey,
            rotatedFrom: existing.id,
         },
         message: 'API key rotated. Save the new key securely — it will not be shown again.',
      });
   }

   static async validateApiKey(req: Request, res: Response) {
      const { key } = req.body;

      if (!key || typeof key !== 'string') {
         throw new ValidationError('API key is required');
      }

      const apiKey = await apiKeyService.validateApiKey(key);

      res.json({
         success: true,
         data: {
            valid: !!apiKey,
            keyId: apiKey?.id || null,
            tier: apiKey?.tier || null,
         },
      });
   }
}
