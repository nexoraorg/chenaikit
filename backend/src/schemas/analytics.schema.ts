/**
 * Analytics validation schemas.
 */
import { z } from 'zod';
import { isoDateStringSchema } from './common.schema';

// ---------------------------------------------------------------------------
// Dashboard query
// ---------------------------------------------------------------------------

export const dashboardQuerySchema = z.object({
  startDate: isoDateStringSchema,
  endDate: isoDateStringSchema,
});

// ---------------------------------------------------------------------------
// Trends query
// ---------------------------------------------------------------------------

export const trendsQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 365),
      { message: 'Days must be a number between 1 and 365' }
    ),
});

// ---------------------------------------------------------------------------
// Export query
// ---------------------------------------------------------------------------

export const exportQuerySchema = z.object({
  format: z
    .string()
    .optional()
    .refine((val) => !val || ['csv', 'pdf'].includes(val), {
      message: 'Format must be either "csv" or "pdf"',
    }),
  type: z
    .string()
    .optional()
    .refine((val) => !val || ['usage', 'transactions'].includes(val), {
      message: 'Type must be either "usage" or "transactions"',
    }),
  days: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 365),
      { message: 'Days must be a number between 1 and 365' }
    ),
});
