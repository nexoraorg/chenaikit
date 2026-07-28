import { z } from 'zod';

const threshold = z.string().regex(/^(>=|<=|>|<|==)\s*-?\d+(\.\d+)?$/);

export const promotionPolicySchema = z.object({
  schemaVersion: z.literal(1),
  minimumDatasetRows: z.number().int().positive(),
  minimumCohortSize: z.number().int().positive(),
  requiredMetrics: z.record(threshold),
  fairness: z.record(threshold),
  explainability: z.object({
    additivityPassRate: threshold,
    maxP95ExplanationMs: z.number().positive(),
  }),
  onFailure: z.enum(['block', 'warn']).default('block'),
});

export const evaluationReportBodySchema = z.object({
  schemaVersion: z.literal(1),
  modelArtifactHash: z.string().regex(/^[a-f0-9]{64}$/i),
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/i),
  codeCommit: z.string().min(7).max(64),
  datasetRows: z.number().int().nonnegative(),
  metrics: z.record(z.number()),
  fairness: z.record(z.union([z.number(), z.array(z.string())])),
  explainability: z.object({
    additivityPassRate: z.number().min(0).max(1),
    p95ExplanationMs: z.number().nonnegative(),
  }),
  policy: promotionPolicySchema,
  modelCard: z.record(z.unknown()).optional(),
});

export const promotionOverrideSchema = z.object({
  authorizedRole: z.enum(['admin', 'ml_governance']),
  reason: z.string().min(20).max(2000),
});
