import { Router, type Router as ExpressRouter } from 'express';
import { ApiKeyService } from '../services/apiKeyService';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../utils/errors';
import { maskApiKey } from '../utils/keyUtils';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();
const apiKeyService = new ApiKeyService(prisma);

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
    
    const { name, tier, type, allowedIps, allowedPaths, expiresAt, usageQuota, permissions, scopes } = req.body;
    
    if (!name) throw new ValidationError('Name is required');

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
 * Get a specific API key (masked)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const apiKey = await apiKeyService.getApiKeyById(req.params.id);
    
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
    const existingKey = await apiKeyService.getApiKeyById(req.params.id);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    const updatedKey = await apiKeyService.updateApiKey(req.params.id, req.body);

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

/**
 * Get API key usage analytics
 */
router.get('/:id/usage', authenticate, async (req, res, next) => {
  try {
    const existingKey = await apiKeyService.getApiKeyById(req.params.id);
    
    if (!existingKey || (req.user?.role !== 'admin' && existingKey.userId !== req.user?.id)) {
      throw new NotFoundError('API key not found');
    }

    const { startDate, endDate } = req.query;
    const usage = await apiKeyService.getApiKeyUsage(
      req.params.id,
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

export default router;
