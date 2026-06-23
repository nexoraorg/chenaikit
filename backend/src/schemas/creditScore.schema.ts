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
// Fraud detection query
// ---------------------------------------------------------------------------

export const fraudDetectionQuerySchema = z.object({
  accountId: accountIdRegex.optional(),
});
