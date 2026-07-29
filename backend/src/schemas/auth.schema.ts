/**
 * Authentication / authorization validation schemas.
 */
import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.schema';

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['user', 'admin']).optional(),
});

export type RegisterInput = z.infer<typeof registerBodySchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginBodySchema>;

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------

export const refreshTokenBodySchema = z.object({
  token: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenBodySchema>;
