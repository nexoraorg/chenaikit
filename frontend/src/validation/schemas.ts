import { z } from 'zod';

// ─── Primitives ──────────────────────────────────────────────────────────────

/** Non-empty trimmed string */
const requiredString = (msg = 'This field is required') =>
  z.string().trim().min(1, msg);

// ─── Blockchain ───────────────────────────────────────────────────────────────

export const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Please enter a valid Stellar address (starts with G, 56 chars)');

export const stellarSecretKeySchema = z
  .string()
  .regex(/^S[A-Z0-9]{55}$/, 'Please enter a valid Stellar secret key (starts with S, 56 chars)');

// ─── Common field schemas ─────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const positiveAmountSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number');

// ─── Composite form schemas ───────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: requiredString('Password is required'),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: requiredString('Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  displayName: requiredString('Display name is required').max(50, 'Max 50 characters'),
  email: emailSchema,
  bio: z.string().max(200, 'Bio must be 200 characters or less').optional(),
});

export const transactionSchema = z.object({
  stellarAddress: stellarAddressSchema,
  amount: positiveAmountSchema,
  memo: z.string().max(100, 'Memo must be 100 characters or less').optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
export type TransactionFormValues = z.infer<typeof transactionSchema>;
