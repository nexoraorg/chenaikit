/**
 * Common reusable validation schemas.
 *
 * These building blocks are composed by feature-specific schemas to ensure
 * consistent validation rules across all API endpoints.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/** Stellar public key: starts with G, 56 chars total, Base32 alphabet. */
export const stellarPublicKeySchema = z
  .string()
  .min(1, 'Public key is required')
  .regex(
    /^G[A-Z2-7]{55}$/,
    'Invalid Stellar public key format. Must start with G and be 56 characters total using Base32 alphabet (A-Z, 2-7)'
  );

/** Generic account / resource ID: alphanumeric, 1-56 characters. */
export const accountIdSchema = z
  .string()
  .min(1, 'Account ID is required')
  .max(56, 'Account ID must be at most 56 characters')
  .regex(/^[A-Za-z0-9]{1,56}$/, 'Invalid account ID format');

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email must be at most 255 characters');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or less');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

// ---------------------------------------------------------------------------
// Pagination & Sorting
// ---------------------------------------------------------------------------

export const pageSchema = z
  .string()
  .optional()
  .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 1), {
    message: 'Page must be a positive integer',
  });

export const limitSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || (!isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 100),
    { message: 'Limit must be between 1 and 100' }
  );

export const sortBySchema = (allowed: string[]) =>
  z
    .string()
    .optional()
    .refine((val) => !val || allowed.includes(val), {
      message: `SortBy must be one of: ${allowed.join(', ')}`,
    });

export const sortOrderSchema = z
  .string()
  .optional()
  .refine((val) => !val || ['asc', 'desc'].includes(val), {
    message: 'SortOrder must be either "asc" or "desc"',
  });

export const paginationQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  sortBy: sortBySchema(['timestamp', 'amount']),
  sortOrder: sortOrderSchema,
});

// ---------------------------------------------------------------------------
// Dates & Timestamps
// ---------------------------------------------------------------------------

export const isoDateStringSchema = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format. Use ISO 8601 (e.g. 2024-01-01)',
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convenience: validates req.params.id
 */
export const pathIdSchema = z.object({
  id: z.string().min(1, 'Resource ID is required'),
});
