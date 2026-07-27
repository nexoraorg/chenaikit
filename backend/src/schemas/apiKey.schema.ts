import { z } from 'zod';

const apiTierEnum = z.enum(['FREE', 'PRO', 'ENTERPRISE']);

export const createApiKeyBodySchema = z.object({
   name: z.string().min(1).max(100),
   tier: apiTierEnum.optional().default('FREE'),
   userId: z.string().optional(),
   allowedIps: z.array(z.string().ip()).optional(),
   allowedPaths: z.array(z.string()).optional(),
   expiresAt: z.string().datetime().optional(),
   usageQuota: z.number().int().positive().optional(),
});

export const updateApiKeyBodySchema = z.object({
   name: z.string().min(1).max(100).optional(),
   tier: apiTierEnum.optional(),
   isActive: z.boolean().optional(),
   allowedIps: z.array(z.string().ip()).optional(),
   allowedPaths: z.array(z.string()).optional(),
   expiresAt: z.string().datetime().optional(),
   usageQuota: z.number().int().positive().optional(),
});

export const apiKeyIdParamsSchema = z.object({
   id: z.string().min(1),
});

export const listApiKeysQuerySchema = z.object({
   page: z.coerce.number().int().positive().default(1),
   limit: z.coerce.number().int().positive().max(100).default(20),
   tier: apiTierEnum.optional(),
   isActive: z.coerce.boolean().optional(),
});

export const apiKeyUsageQuerySchema = z.object({
   startDate: z.string().datetime().optional(),
   endDate: z.string().datetime().optional(),
});

export const rotateApiKeyBodySchema = z.object({
   name: z.string().min(1).max(100).optional(),
   tier: apiTierEnum.optional(),
   allowedIps: z.array(z.string().ip()).optional(),
   allowedPaths: z.array(z.string()).optional(),
   expiresAt: z.string().datetime().optional(),
   usageQuota: z.number().int().positive().optional(),
});

export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
export type UpdateApiKeyBody = z.infer<typeof updateApiKeyBodySchema>;
export type RotateApiKeyBody = z.infer<typeof rotateApiKeyBodySchema>;
