import {
  emailSchema,
  passwordSchema,
  positiveAmountSchema,
  stellarAddressSchema,
  stellarSecretKeySchema,
  loginSchema,
  signupSchema,
  profileSchema,
  transactionSchema,
} from '../schemas';

describe('validation/schemas', () => {
  // ─── emailSchema ───────────────────────────────────────────────────────
  describe('emailSchema', () => {
    it('accepts a valid email', () => {
      expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    });
    it('rejects an empty string', () => {
      expect(emailSchema.safeParse('').success).toBe(false);
    });
    it('rejects a malformed email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    });
  });

  // ─── passwordSchema ────────────────────────────────────────────────────
  describe('passwordSchema', () => {
    it('accepts a valid password', () => {
      expect(passwordSchema.safeParse('Password1').success).toBe(true);
    });
    it('rejects a short password', () => {
      expect(passwordSchema.safeParse('Pass1').success).toBe(false);
    });
    it('rejects a password without uppercase', () => {
      expect(passwordSchema.safeParse('password1').success).toBe(false);
    });
    it('rejects a password without digit', () => {
      expect(passwordSchema.safeParse('Password').success).toBe(false);
    });
  });

  // ─── positiveAmountSchema ──────────────────────────────────────────────
  describe('positiveAmountSchema', () => {
    it('accepts "100"', () => {
      expect(positiveAmountSchema.safeParse('100').success).toBe(true);
    });
    it('accepts "0.01"', () => {
      expect(positiveAmountSchema.safeParse('0.01').success).toBe(true);
    });
    it('rejects "0"', () => {
      expect(positiveAmountSchema.safeParse('0').success).toBe(false);
    });
    it('rejects negative value', () => {
      expect(positiveAmountSchema.safeParse('-5').success).toBe(false);
    });
    it('rejects non-numeric string', () => {
      expect(positiveAmountSchema.safeParse('abc').success).toBe(false);
    });
  });

  // ─── stellarAddressSchema ──────────────────────────────────────────────
  // Valid Stellar addresses are 56 chars: G + 55 alphanumeric chars
  describe('stellarAddressSchema', () => {
    const valid = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0'; // 56 chars
    it('accepts a valid Stellar address', () => {
      expect(stellarAddressSchema.safeParse(valid).success).toBe(true);
    });
    it('rejects an address not starting with G', () => {
      expect(stellarAddressSchema.safeParse('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0').success).toBe(false);
    });
    it('rejects a short address', () => {
      expect(stellarAddressSchema.safeParse('GSHORT').success).toBe(false);
    });
  });

  // ─── stellarSecretKeySchema ────────────────────────────────────────────
  // Valid Stellar secret keys are 56 chars: S + 55 alphanumeric chars
  describe('stellarSecretKeySchema', () => {
    const valid = 'SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0'; // 56 chars
    it('accepts a valid Stellar secret key', () => {
      expect(stellarSecretKeySchema.safeParse(valid).success).toBe(true);
    });
    it('rejects a key not starting with S', () => {
      expect(stellarSecretKeySchema.safeParse('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0').success).toBe(false);
    });
  });

  // ─── loginSchema ───────────────────────────────────────────────────────
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      expect(loginSchema.safeParse({ email: 'u@example.com', password: 'secret' }).success).toBe(true);
    });
    it('rejects empty email', () => {
      expect(loginSchema.safeParse({ email: '', password: 'secret' }).success).toBe(false);
    });
    it('rejects missing password', () => {
      expect(loginSchema.safeParse({ email: 'u@example.com', password: '' }).success).toBe(false);
    });
  });

  // ─── signupSchema ──────────────────────────────────────────────────────
  describe('signupSchema', () => {
    const base = { email: 'u@example.com', password: 'Password1', confirmPassword: 'Password1' };
    it('accepts matching passwords', () => {
      expect(signupSchema.safeParse(base).success).toBe(true);
    });
    it('rejects mismatched passwords', () => {
      const result = signupSchema.safeParse({ ...base, confirmPassword: 'Different1' });
      expect(result.success).toBe(false);
    });
  });

  // ─── profileSchema ─────────────────────────────────────────────────────
  describe('profileSchema', () => {
    it('accepts valid profile', () => {
      expect(profileSchema.safeParse({ displayName: 'Alice', email: 'a@b.com' }).success).toBe(true);
    });
    it('accepts optional bio', () => {
      expect(profileSchema.safeParse({ displayName: 'Alice', email: 'a@b.com', bio: 'Hi' }).success).toBe(true);
    });
    it('rejects empty displayName', () => {
      expect(profileSchema.safeParse({ displayName: '', email: 'a@b.com' }).success).toBe(false);
    });
    it('rejects bio exceeding 200 chars', () => {
      const long = 'x'.repeat(201);
      expect(profileSchema.safeParse({ displayName: 'Alice', email: 'a@b.com', bio: long }).success).toBe(false);
    });
  });

  // ─── transactionSchema ─────────────────────────────────────────────────
  describe('transactionSchema', () => {
    const addr = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0'; // 56 chars
    it('accepts a valid transaction', () => {
      expect(transactionSchema.safeParse({ stellarAddress: addr, amount: '10' }).success).toBe(true);
    });
    it('rejects invalid stellar address', () => {
      expect(transactionSchema.safeParse({ stellarAddress: 'bad', amount: '10' }).success).toBe(false);
    });
    it('rejects non-positive amount', () => {
      expect(transactionSchema.safeParse({ stellarAddress: addr, amount: '0' }).success).toBe(false);
    });
  });
});
