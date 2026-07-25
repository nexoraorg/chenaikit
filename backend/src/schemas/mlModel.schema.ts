/**
 * ML model registry & A/B experiment validation schemas.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

export const registerModelBodySchema = z.object({
  name: z.string().min(1, 'Model name is required').max(150),
  description: z.string().max(2000).optional(),
  taskType: z.string().min(1, 'taskType is required').max(100),
});

export const modelIdParamsSchema = z.object({
  modelId: z.string().min(1, 'modelId is required'),
});

export const registerVersionBodySchema = z.object({
  version: z.string().min(1, 'version is required').max(50),
  artifactUri: z.string().min(1, 'artifactUri is required'),
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'contentHash must be a SHA256 hex digest')
    .optional(),
  frameworkVersion: z.string().max(100).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  precision: z.number().min(0).max(1).optional(),
  recall: z.number().min(0).max(1).optional(),
  f1Score: z.number().min(0).max(1).optional(),
  auc: z.number().min(0).max(1).optional(),
  trainingDataUri: z.string().optional(),
  trainingDataHash: z.string().optional(),
  hyperparameters: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  datasetVersion: z.string().max(100).optional(),
  codeCommit: z.string().max(64).optional(),
  trainingRunId: z.string().max(150).optional(),
});

export const versionIdParamsSchema = z.object({
  versionId: z.string().min(1, 'versionId is required'),
});

export const promoteVersionBodySchema = z.object({
  approvedBy: z.string().min(1, 'approvedBy is required for the promotion approval gate'),
});

export const rollbackBodySchema = z.object({
  targetVersionId: z.string().min(1, 'targetVersionId is required'),
  actor: z.string().min(1, 'actor is required'),
});

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------

export const experimentVariantSchema = z.object({
  name: z.string().min(1).max(100),
  modelVersionId: z.string().min(1),
  trafficWeight: z.number().min(0).max(100),
  isControl: z.boolean().optional(),
});

export const createExperimentBodySchema = z.object({
  key: z
    .string()
    .min(1, 'key is required')
    .max(100)
    .regex(/^[a-z0-9-_]+$/i, 'key must be alphanumeric with dashes/underscores'),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  modelId: z.string().min(1, 'modelId is required'),
  hypothesis: z.string().max(2000).optional(),
  metric: z.string().min(1, 'metric is required').max(100),
  minimumDetectableEffect: z.number().positive().optional(),
  significanceLevel: z.number().min(0.001).max(0.5).optional(),
  power: z.number().min(0.5).max(0.999).optional(),
  bonferroniCorrection: z.boolean().optional(),
  canaryThresholdPct: z.number().min(0).max(100).optional(),
  canaryWindowHours: z.number().int().min(1).max(720).optional(),
  variants: z.array(experimentVariantSchema).min(2, 'At least two variants are required'),
});

export const experimentIdParamsSchema = z.object({
  experimentId: z.string().min(1, 'experimentId is required'),
});

export const assignVariantBodySchema = z.object({
  subjectId: z.string().min(1, 'subjectId is required'),
});

export const trackConversionBodySchema = z.object({
  subjectId: z.string().min(1, 'subjectId is required'),
  metricValue: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

export const recordDriftCheckBodySchema = z.object({
  windowStart: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid windowStart date'),
  windowEnd: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid windowEnd date'),
  baselineAuc: z.number().min(0).max(1),
  observedAuc: z.number().min(0).max(1),
  alertThresholdPct: z.number().min(0).max(100).optional(),
  canaryThresholdPct: z.number().min(0).max(100).optional(),
  autoRollbackActor: z.string().optional(),
});
