import { Router, type Router as ExpressRouter } from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../utils/errors';
import { maskApiKey } from '../utils/keyUtils';
import { z } from 'zod';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();
const apiKeyService = new ApiKeyService(prisma);

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional(),
  type: z.enum(['READ_ONLY', 'READ_WRITE', 'ADMIN', 'SCOPED', 'TEMPORARY']).optional(),
  allowedIps: z.array(z.string().ip()).optional(),
  allowedPaths: z.array(z.string().max(128)).optional(),
  expiresAt: z.string().datetime().optional(),
  usageQuota: z.number().positive().optional(),
  permissions: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
});

const UpdateKeySchema = CreateKeySchema.partial().extend({
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'INACTIVE']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * List all API keys for the authenticated user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!req.user) throw new ValidationError('User not authenticated');
    
    const apiKeys = await apiKeyService.getApiKeysByUserId(req.user.id);
    
    res.json({
      success: true,
      data: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        type: key.type,
        status: key.status,
        tier: key.tier,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new API key
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!req.user) throw new ValidationError('User not authenticated');
    
    const validation = CreateKeySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(`Invalid input: ${validation.error.message}`);
    }

    const { name, tier, type, allowedIps, allowedPaths, expiresAt, usageQuota, permissions, scopes } = validation.data;

    const { apiKey, plainKey } = await apiKeyService.createApiKey({
      name,
      tier,
      type,
      userId: req.user.id,
      allowedIps,
      allowedPaths,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      usageQuota,
      permissions,
      scopes
    });

    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          type: apiKey.type,
          status: apiKey.status,
          tier: apiKey.tier,
          createdAt: apiKey.createdAt
        },
        plainKey // Only shown once upon creation
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get API key usage analytics
 */
router.get('/:id/usage', authenticate, async (req, res, next) => {
  try {
    const id = z.string().cuid().safeParse(req.params.id);
    if (!id.success) throw new ValidationError('Invalid ID format');

    const existingKey = await apiKeyService.getApiKeyById(id.data);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    const { startDate, endDate } = req.query;
    const usage = await apiKeyService.getApiKeyUsage(
      id.data,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific API key (masked)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = z.string().cuid().safeParse(req.params.id);
    if (!id.success) throw new ValidationError('Invalid ID format');

    const apiKey = await apiKeyService.getApiKeyById(id.data);
    
    if (!apiKey || (req.user?.role !== 'admin' && apiKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    res.json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        type: apiKey.type,
        status: apiKey.status,
        tier: apiKey.tier,
        permissions: apiKey.permissions,
        scopes: apiKey.scopes,
        allowedIps: apiKey.allowedIps,
        allowedPaths: apiKey.allowedPaths,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        usageCount: apiKey.usageCount,
        successCount: apiKey.successCount,
        failureCount: apiKey.failureCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update an API key
 */
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const id = z.string().cuid().safeParse(req.params.id);
    if (!id.success) throw new ValidationError('Invalid ID format');

    const validation = UpdateKeySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(`Invalid input: ${validation.error.message}`);
    }

    const existingKey = await apiKeyService.getApiKeyById(id.data);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    const updatedKey = await apiKeyService.updateApiKey(id.data, {
      ...validation.data,
      expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : undefined,
    });

    res.json({
      success: true,
      data: updatedKey
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Rotate an API key
 */
router.post('/:id/rotate', authenticate, async (req, res, next) => {
  try {
    const existingKey = await apiKeyService.getApiKeyById(req.params.id);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    const { apiKey, plainKey } = await apiKeyService.rotateApiKey(req.params.id);

    res.json({
      success: true,
      message: 'API key has been rotated. The old key is now revoked.',
      data: {
        apiKey,
        plainKey
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke an API key
 */
router.post('/:id/revoke', authenticate, async (req, res, next) => {
  try {
    const existingKey = await apiKeyService.getApiKeyById(req.params.id);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    await apiKeyService.revokeApiKey(req.params.id);

    res.json({
      success: true,
      message: 'API key has been revoked'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
