/**
 * Feature flag validation schemas.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Flag types / enums
// ---------------------------------------------------------------------------

const flagTypeSchema = z.enum([
  'boolean',
  'multivariate',
  'remote_config',
  'ab_test',
  'kill_switch',
]);

const targetingTypeSchema = z.enum([
  'user',
  'segment',
  'percentage',
  'property',
]);

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const flagVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  value: z.unknown(),
  weight: z.number().min(0, 'Weight must be >= 0'),
});

const targetingRuleSchema = z.object({
  type: targetingTypeSchema,
  values: z.array(z.string()).min(1, 'At least one targeting value is required'),
  property: z.string().optional(),
});

const flagScheduleSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Create Flag
// ---------------------------------------------------------------------------

export const createFeatureFlagBodySchema = z.object({
  key: z
    .string()
    .min(1, 'Flag key is required')
    .max(100, 'Flag key must be at most 100 characters')
    .regex(/^[a-z][a-z0-9_]*$/, 'Flag key must start with a letter and contain only lowercase letters, numbers, and underscores'),
  name: z.string().min(1, 'Flag name is required').max(200, 'Flag name must be at most 200 characters'),
  description: z.string().max(1000).optional(),
  type: flagTypeSchema,
  enabled: z.boolean(),
  defaultValue: z.unknown(),
  variants: z.array(flagVariantSchema).optional(),
  targeting: z.array(targetingRuleSchema).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  dependencies: z.array(z.string()).optional(),
  schedule: flagScheduleSchema.optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagBodySchema>;

// ---------------------------------------------------------------------------
// Update Flag
// ---------------------------------------------------------------------------

export const updateFeatureFlagBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  type: flagTypeSchema.optional(),
  enabled: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  variants: z.array(flagVariantSchema).optional(),
  targeting: z.array(targetingRuleSchema).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  dependencies: z.array(z.string()).optional(),
  schedule: flagScheduleSchema.optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagBodySchema>;

// ---------------------------------------------------------------------------
// Evaluate flags
// ---------------------------------------------------------------------------

export const evaluateFlagsBodySchema = z.object({
  keys: z.array(z.string()).optional(),
  context: z
    .object({
      userId: z.string().optional(),
      email: z.string().email().optional(),
      ip: z.string().optional(),
      userAgent: z.string().optional(),
      segments: z.array(z.string()).optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Override
// ---------------------------------------------------------------------------

export const setOverrideBodySchema = z.object({
  value: z.unknown(),
});

// ---------------------------------------------------------------------------
// Flag key (path param)
// ---------------------------------------------------------------------------

export const flagKeyParamsSchema = z.object({
  key: z.string().min(1, 'Flag key is required'),
});
