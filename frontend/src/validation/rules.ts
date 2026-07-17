import { z } from 'zod';

/**
 * Reusable Zod-based validation rules that can be composed into schemas.
 * Each factory returns a ZodTypeAny so they work both standalone and with
 * `zodResolver` from @hookform/resolvers/zod.
 */

// ─── Primitive rules ──────────────────────────────────────────────────────────

export const rules = {
  required: (msg = 'This field is required') => z.string().trim().min(1, msg),

  email: (msg = 'Please enter a valid email address') =>
    z.string().trim().min(1, 'Email is required').email(msg),

  minLength: (min: number, msg?: string) =>
    z.string().min(min, msg ?? `Must be at least ${min} characters`),

  maxLength: (max: number, msg?: string) =>
    z.string().max(max, msg ?? `Must be no more than ${max} characters`),

  pattern: (regex: RegExp, msg: string) =>
    z.string().regex(regex, msg),

  url: (msg = 'Please enter a valid URL') =>
    z.string().url(msg),

  positiveNumber: (msg = 'Must be a positive number') =>
    z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, msg),

  /** Stellar public key: starts with 'G', 56 chars total */
  stellarAddress: (msg = 'Please enter a valid Stellar address') =>
    z.string().regex(/^G[A-Z0-9]{55}$/, msg),

  /** Stellar secret key: starts with 'S', 56 chars total */
  stellarSecretKey: (msg = 'Please enter a valid Stellar secret key') =>
    z.string().regex(/^S[A-Z0-9]{55}$/, msg),

  /**
   * Async rule — wraps an async predicate so the error message is clear.
   * Usage: `rules.asyncCheck(checkAddressExists, 'Address does not exist')`
   */
  asyncCheck: <T>(
    fn: (value: T) => Promise<boolean>,
    msg: string,
  ) =>
    z.any().superRefine(async (val: T, ctx) => {
      const ok = await fn(val);
      if (!ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      }
    }),
};

export type Rules = typeof rules;
