import { rules } from '../rules';

describe('validation/rules', () => {
  describe('rules.required', () => {
    it('accepts a non-empty string', () => {
      expect(rules.required().safeParse('hello').success).toBe(true);
    });
    it('rejects an empty string', () => {
      expect(rules.required().safeParse('').success).toBe(false);
    });
    it('uses custom message', () => {
      const result = rules.required('Custom msg').safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toBe('Custom msg');
    });
  });

  describe('rules.email', () => {
    it('accepts a valid email', () => {
      expect(rules.email().safeParse('a@b.com').success).toBe(true);
    });
    it('rejects an invalid email', () => {
      expect(rules.email().safeParse('not-email').success).toBe(false);
    });
  });

  describe('rules.minLength', () => {
    it('accepts string meeting the minimum', () => {
      expect(rules.minLength(3).safeParse('abc').success).toBe(true);
    });
    it('rejects string below the minimum', () => {
      expect(rules.minLength(3).safeParse('ab').success).toBe(false);
    });
  });

  describe('rules.maxLength', () => {
    it('accepts string within the maximum', () => {
      expect(rules.maxLength(5).safeParse('abc').success).toBe(true);
    });
    it('rejects string over the maximum', () => {
      expect(rules.maxLength(5).safeParse('toolong').success).toBe(false);
    });
  });

  describe('rules.url', () => {
    it('accepts a valid URL', () => {
      expect(rules.url().safeParse('https://example.com').success).toBe(true);
    });
    it('rejects an invalid URL', () => {
      expect(rules.url().safeParse('not-a-url').success).toBe(false);
    });
  });

  describe('rules.positiveNumber', () => {
    it('accepts "42"', () => {
      expect(rules.positiveNumber().safeParse('42').success).toBe(true);
    });
    it('accepts "0.1"', () => {
      expect(rules.positiveNumber().safeParse('0.1').success).toBe(true);
    });
    it('rejects "0"', () => {
      expect(rules.positiveNumber().safeParse('0').success).toBe(false);
    });
    it('rejects negative', () => {
      expect(rules.positiveNumber().safeParse('-1').success).toBe(false);
    });
    it('rejects non-numeric', () => {
      expect(rules.positiveNumber().safeParse('abc').success).toBe(false);
    });
  });

  describe('rules.stellarAddress', () => {
    // Valid: G + 55 alphanumeric chars = 56 total
    const valid = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0';
    it('accepts a valid address', () => {
      expect(rules.stellarAddress().safeParse(valid).success).toBe(true);
    });
    it('rejects wrong start char', () => {
      const bad = 'SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0';
      expect(rules.stellarAddress().safeParse(bad).success).toBe(false);
    });
    it('rejects too short', () => {
      expect(rules.stellarAddress().safeParse('GSHORT').success).toBe(false);
    });
  });

  describe('rules.stellarSecretKey', () => {
    // Valid: S + 55 alphanumeric chars = 56 total
    const valid = 'SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0';
    it('accepts a valid secret key', () => {
      expect(rules.stellarSecretKey().safeParse(valid).success).toBe(true);
    });
    it('rejects wrong start char', () => {
      const bad = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN0';
      expect(rules.stellarSecretKey().safeParse(bad).success).toBe(false);
    });
  });

  describe('rules.asyncCheck', () => {
    it('resolves without error when predicate returns true', async () => {
      const schema = rules.asyncCheck(async () => true, 'Failed');
      const result = await schema.safeParseAsync('anything');
      expect(result.success).toBe(true);
    });
    it('adds an issue when predicate returns false', async () => {
      const schema = rules.asyncCheck(async () => false, 'Custom failure');
      const result = await schema.safeParseAsync('anything');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Custom failure');
      }
    });
  });
});
