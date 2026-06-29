/**
 * Credit score & fraud detection validation schemas.
 */
import { z } from 'zod';

const accountIdRegex = z.string().regex(/^[A-Za-z0-9]{1,56}$/, 'Invalid account ID format');

// ---------------------------------------------------------------------------
// Credit score query
// ---------------------------------------------------------------------------

export const creditScoreQuerySchema = z.object({
  accountId: accountIdRegex.optional(),
});

// ---------------------------------------------------------------------------
// Credit score calculate (POST /api/v2/credit-score/calculate)
// ---------------------------------------------------------------------------

export const creditScoreCalculateSchema = z.object({
  accountId: accountIdRegex,
  userId: z.string().uuid().optional(),
  model: z.string().optional(),
  includeFactors: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Credit score history query (GET /api/v2/credit-score/history/:accountId)
// ---------------------------------------------------------------------------

export const creditScoreHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Fraud detection query
// ---------------------------------------------------------------------------

export const fraudDetectionQuerySchema = z.object({
  accountId: accountIdRegex.optional(),
});

// ---------------------------------------------------------------------------
// Fraud detection analyze (POST /api/v2/fraud/analyze)
// ---------------------------------------------------------------------------

export const fraudAnalyzeSchema = z.object({
  transactionId: z.string().uuid().optional(),
  accountId: accountIdRegex,
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  merchant: z.string().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  deviceId: z.string().optional(),
  ip: z.string().ip().optional(),
  timestamp: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Fraud alerts query (GET /api/v2/fraud/alerts)
// ---------------------------------------------------------------------------

export const fraudAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  resolved: z.coerce.boolean().optional(),
  alertType: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Fraud alert acknowledge (POST /api/v2/fraud/alerts/:id/acknowledge)
// ---------------------------------------------------------------------------

export const fraudAlertAcknowledgeSchema = z.object({
  notes: z.string().optional(),
});
