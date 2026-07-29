import { z } from 'zod';

export const receiptIdParamsSchema = z.object({
  receiptId: z.string().min(1, 'receiptId is required'),
});

export const publicKeySchema = z.string().regex(/^[a-f0-9]{64}$/i, 'publicKey must be a hex-encoded 32-byte value');

export const signedInferenceReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  receiptId: z.string().min(1),
  nonce: z.string().min(1),
  issuedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), 'issuedAt must be a valid ISO 8601 date'),
  expiresAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), 'expiresAt must be a valid ISO 8601 date').optional(),
  requestId: z.string().optional(),
  correlationId: z.string().optional(),
  subjectCommitment: z.string().min(1),
  modelId: z.string().min(1),
  modelVersionId: z.string().min(1),
  modelSemanticVersion: z.string().optional(),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/i, 'artifactHash must be a SHA256 hex digest'),
  featureSchemaHash: z.string().regex(/^[a-f0-9]{64}$/i, 'featureSchemaHash must be a SHA256 hex digest'),
  featureCommitment: z.string().regex(/^[a-f0-9]{64}$/i, 'featureCommitment must be a SHA256 hex digest'),
  featureMerkleRoot: z.string().regex(/^[a-f0-9]{64}$/i, 'featureMerkleRoot must be a SHA256 hex digest').optional(),
  outputCommitment: z.string().regex(/^[a-f0-9]{64}$/i, 'outputCommitment must be a SHA256 hex digest'),
  publicResultSummary: z.record(z.unknown()).optional(),
  keyId: z.string().min(1),
  network: z.string().min(1),
  ledgerBounds: z.object({
    minLedger: z.number().int().nonnegative().optional(),
    maxLedger: z.number().int().nonnegative().optional(),
  }).optional(),
  batchId: z.string().min(1).optional(),
  signature: z.string().regex(/^[a-f0-9]{128}$/i, 'signature must be a hex-encoded 64-byte Ed25519 signature'),
  signatureScheme: z.literal('ed25519'),
});

export const verifyReceiptBodySchema = z.object({
  receipt: signedInferenceReceiptSchema,
});

export const createReceiptBodySchema = z.object({
  receipt: signedInferenceReceiptSchema,
});
