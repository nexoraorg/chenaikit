/**
 * Account validation schemas.
 */
import { z } from 'zod';
import { nameSchema, emailSchema, stellarPublicKeySchema } from './common.schema';

// ---------------------------------------------------------------------------
// Account Creation
// ---------------------------------------------------------------------------

export const createAccountBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  publicKey: stellarPublicKeySchema,
});

export type CreateAccountInput = z.infer<typeof createAccountBodySchema>;

// ---------------------------------------------------------------------------
// Account ID (path param)
// ---------------------------------------------------------------------------

export const accountIdParamsSchema = z.object({
  id: z
    .string()
    .min(1, 'Account ID is required')
    .max(56, 'Account ID must be at most 56 characters')
    .regex(/^[A-Za-z0-9]{1,56}$/, 'Invalid account ID format'),
});
