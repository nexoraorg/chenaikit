/**
 * Validation Schemas Tests
 *
 * Verify that each Zod schema correctly accepts valid inputs and rejects
 * invalid ones with appropriate error messages.
 */
import {
  createAccountBodySchema,
  accountIdParamsSchema,
  paginationQuerySchema,
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  createFeatureFlagBodySchema,
  updateFeatureFlagBodySchema,
  evaluateFlagsBodySchema,
  setOverrideBodySchema,
  flagKeyParamsSchema,
  creditScoreQuerySchema,
  fraudDetectionQuerySchema,
  dashboardQuerySchema,
  trendsQuerySchema,
  exportQuerySchema,
  emailSchema,
  nameSchema,
  stellarPublicKeySchema,
  accountIdSchema,
  passwordSchema,
} from '../index';

describe('Validation Schemas', () => {
  // --------------------------------------------------------------------------
  // Common schemas
  // --------------------------------------------------------------------------
  describe('emailSchema', () => {
    it('accepts valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('user+tag@domain.co').success).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(emailSchema.safeParse('').success).toBe(false);
      expect(emailSchema.safeParse('invalid-email').success).toBe(false);
      expect(emailSchema.safeParse('@missing-local.com').success).toBe(false);
    });
  });

  describe('nameSchema', () => {
    it('accepts valid names and trims', () => {
      const result = nameSchema.safeParse('  John  ');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('John');
    });

    it('rejects empty names', () => {
      expect(nameSchema.safeParse('').success).toBe(false);
      expect(nameSchema.safeParse('   ').success).toBe(false);
    });

    it('rejects names over 100 chars', () => {
      expect(nameSchema.safeParse('a'.repeat(101)).success).toBe(false);
    });
  });

  describe('stellarPublicKeySchema', () => {
    it('accepts valid stellar public keys', () => {
      expect(
        stellarPublicKeySchema.safeParse('GABC234567DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ').success
      ).toBe(true);
    });

    it('rejects keys not starting with G', () => {
      expect(stellarPublicKeySchema.safeParse('ABC234567DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP').success).toBe(false);
    });

    it('rejects short keys', () => {
      expect(stellarPublicKeySchema.safeParse('GABC').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('accepts passwords >= 8 chars', () => {
      expect(passwordSchema.safeParse('12345678').success).toBe(true);
      expect(passwordSchema.safeParse('verylongpassword').success).toBe(true);
    });

    it('rejects passwords < 8 chars', () => {
      expect(passwordSchema.safeParse('1234567').success).toBe(false);
    });
  });

  describe('accountIdSchema', () => {
    it('accepts valid alphanumeric IDs', () => {
      expect(accountIdSchema.safeParse('GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK').success).toBe(true);
    });

    it('rejects IDs with special characters', () => {
      expect(accountIdSchema.safeParse('invalid@id!').success).toBe(false);
    });

    it('rejects empty IDs', () => {
      expect(accountIdSchema.safeParse('').success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Account schemas
  // --------------------------------------------------------------------------
  describe('createAccountBodySchema', () => {
    const validBody = {
      name: 'Test User',
      email: 'test@example.com',
      publicKey: 'GABC234567DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ',
    };

    it('accepts valid account creation data', () => {
      expect(createAccountBodySchema.safeParse(validBody).success).toBe(true);
    });

    it('rejects missing name', () => {
      const { name, ...rest } = validBody;
      expect(createAccountBodySchema.safeParse(rest).success).toBe(false);
    });

    it('rejects invalid email', () => {
      expect(createAccountBodySchema.safeParse({ ...validBody, email: 'bad' }).success).toBe(false);
    });

    it('rejects invalid public key', () => {
      expect(createAccountBodySchema.safeParse({ ...validBody, publicKey: 'BAD_KEY' }).success).toBe(false);
    });
  });

  describe('accountIdParamsSchema', () => {
    it('accepts valid params', () => {
      expect(accountIdParamsSchema.safeParse({ id: 'GCKF123' }).success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(accountIdParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('paginationQuerySchema', () => {
    it('accepts valid pagination', () => {
      expect(paginationQuerySchema.safeParse({ page: '1', limit: '10' }).success).toBe(true);
      expect(paginationQuerySchema.safeParse({}).success).toBe(true); // all optional
    });

    it('rejects negative page', () => {
      expect(paginationQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    });

    it('rejects limit over 100', () => {
      expect(paginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Auth schemas
  // --------------------------------------------------------------------------
  describe('registerBodySchema', () => {
    it('accepts valid registration', () => {
      expect(
        registerBodySchema.safeParse({ email: 'a@b.com', password: '12345678' }).success
      ).toBe(true);
      expect(
        registerBodySchema.safeParse({ email: 'a@b.com', password: '12345678', role: 'admin' }).success
      ).toBe(true);
    });

    it('rejects short password', () => {
      expect(
        registerBodySchema.safeParse({ email: 'a@b.com', password: '1234567' }).success
      ).toBe(false);
    });

    it('rejects invalid role', () => {
      expect(
        registerBodySchema.safeParse({ email: 'a@b.com', password: '12345678', role: 'superadmin' }).success
      ).toBe(false);
    });
  });

  describe('loginBodySchema', () => {
    it('accepts valid login', () => {
      expect(loginBodySchema.safeParse({ email: 'a@b.com', password: '12345678' }).success).toBe(true);
    });

    it('rejects missing fields', () => {
      expect(loginBodySchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    });
  });

  describe('refreshTokenBodySchema', () => {
    it('accepts valid token', () => {
      expect(refreshTokenBodySchema.safeParse({ token: 'abc' }).success).toBe(true);
    });

    it('rejects empty token', () => {
      expect(refreshTokenBodySchema.safeParse({ token: '' }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature flag schemas
  // --------------------------------------------------------------------------
  describe('createFeatureFlagBodySchema', () => {
    const validFlag = {
      key: 'my_feature',
      name: 'My Feature',
      description: 'A test feature',
      type: 'boolean' as const,
      enabled: true,
      defaultValue: false,
    };

    it('accepts valid flag creation', () => {
      expect(createFeatureFlagBodySchema.safeParse(validFlag).success).toBe(true);
    });

    it('rejects flag key starting with uppercase', () => {
      expect(createFeatureFlagBodySchema.safeParse({ ...validFlag, key: 'MyFeature' }).success).toBe(false);
    });

    it('rejects invalid flag type', () => {
      expect(createFeatureFlagBodySchema.safeParse({ ...validFlag, type: 'unknown' }).success).toBe(false);
    });
  });

  describe('updateFeatureFlagBodySchema', () => {
    it('accepts partial updates', () => {
      expect(updateFeatureFlagBodySchema.safeParse({ enabled: true }).success).toBe(true);
      expect(updateFeatureFlagBodySchema.safeParse({}).success).toBe(true);
    });
  });

  describe('evaluateFlagsBodySchema', () => {
    it('accepts evaluate with keys', () => {
      expect(
        evaluateFlagsBodySchema.safeParse({ keys: ['flag1', 'flag2'] }).success
      ).toBe(true);
    });

    it('accepts evaluate with context', () => {
      expect(
        evaluateFlagsBodySchema.safeParse({
          context: { userId: 'user1', properties: { region: 'us' } },
        }).success
      ).toBe(true);
    });
  });

  describe('setOverrideBodySchema', () => {
    it('accepts any value', () => {
      expect(setOverrideBodySchema.safeParse({ value: true }).success).toBe(true);
      expect(setOverrideBodySchema.safeParse({ value: 'active' }).success).toBe(true);
      expect(setOverrideBodySchema.safeParse({ value: 123 }).success).toBe(true);
    });
  });

  describe('flagKeyParamsSchema', () => {
    it('accepts valid key', () => {
      expect(flagKeyParamsSchema.safeParse({ key: 'my_flag' }).success).toBe(true);
    });

    it('rejects empty key', () => {
      expect(flagKeyParamsSchema.safeParse({ key: '' }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Credit score & fraud schemas
  // --------------------------------------------------------------------------
  describe('creditScoreQuerySchema', () => {
    it('accepts empty query', () => {
      expect(creditScoreQuerySchema.safeParse({}).success).toBe(true);
    });

    it('accepts valid accountId', () => {
      expect(creditScoreQuerySchema.safeParse({ accountId: 'GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK' }).success).toBe(true);
    });

    it('rejects invalid accountId', () => {
      expect(creditScoreQuerySchema.safeParse({ accountId: '!@#' }).success).toBe(false);
    });
  });

  describe('fraudDetectionQuerySchema', () => {
    it('accepts empty query', () => {
      expect(fraudDetectionQuerySchema.safeParse({}).success).toBe(true);
    });

    it('accepts valid accountId', () => {
      expect(fraudDetectionQuerySchema.safeParse({ accountId: 'GCKF123' }).success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Analytics schemas
  // --------------------------------------------------------------------------
  describe('dashboardQuerySchema', () => {
    it('accepts empty query', () => {
      expect(dashboardQuerySchema.safeParse({}).success).toBe(true);
    });

    it('accepts valid dates', () => {
      expect(
        dashboardQuerySchema.safeParse({ startDate: '2024-01-01', endDate: '2024-12-31' }).success
      ).toBe(true);
    });

    it('rejects invalid date', () => {
      expect(
        dashboardQuerySchema.safeParse({ startDate: 'not-a-date' }).success
      ).toBe(false);
    });
  });

  describe('trendsQuerySchema', () => {
    it('accepts valid days', () => {
      expect(trendsQuerySchema.safeParse({ days: '30' }).success).toBe(true);
    });

    it('rejects days over 365', () => {
      expect(trendsQuerySchema.safeParse({ days: '400' }).success).toBe(false);
    });
  });

  describe('exportQuerySchema', () => {
    it('accepts valid export params', () => {
      expect(exportQuerySchema.safeParse({ format: 'csv', type: 'usage', days: '30' }).success).toBe(true);
    });

    it('rejects invalid format', () => {
      expect(exportQuerySchema.safeParse({ format: 'xlsx' }).success).toBe(false);
    });
  });
});
