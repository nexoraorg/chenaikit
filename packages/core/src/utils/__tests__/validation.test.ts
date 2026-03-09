import { ValidationRules, validateField, validateFields } from '../validation';

describe('Validation Utils', () => {
  describe('ValidationRules', () => {
    describe('required', () => {
      it('should return error for empty string', () => {
        const rule = ValidationRules.required();
        expect(rule.custom!('')).toBe('This field is required');
      });

      it('should return error for whitespace only', () => {
        const rule = ValidationRules.required();
        expect(rule.custom!('   ')).toBe('This field is required');
      });

      it('should return null for non-empty string', () => {
        const rule = ValidationRules.required();
        expect(rule.custom!('test')).toBeNull();
      });

      it('should return null for non-empty value', () => {
        const rule = ValidationRules.required();
        expect(rule.custom!(123)).toBeNull();
      });
    });

    describe('email', () => {
      it('should validate correct email formats', () => {
        const rule = ValidationRules.email();
        expect(rule.custom!('test@example.com')).toBeNull();
        expect(rule.custom!('user.name+tag@domain.co.uk')).toBeNull();
      });

      it('should reject invalid email formats', () => {
        const rule = ValidationRules.email();
        expect(rule.custom!('invalid-email')).not.toBeNull();
        expect(rule.custom!('@domain.com')).not.toBeNull();
        expect(rule.custom!('user@')).not.toBeNull();
      });

      it('should allow empty values', () => {
        const rule = ValidationRules.email();
        expect(rule.custom!('')).toBeNull();
        expect(rule.custom!(null)).toBeNull();
      });
    });

    describe('minLength', () => {
      it('should validate minimum length', () => {
        const rule = ValidationRules.minLength(5);
        expect(rule.custom!('12345')).toBeNull();
        expect(rule.custom!('1234')).not.toBeNull();
      });

      it('should allow empty values', () => {
        const rule = ValidationRules.minLength(5);
        expect(rule.custom!('')).toBeNull();
      });
    });

    describe('maxLength', () => {
      it('should validate maximum length', () => {
        const rule = ValidationRules.maxLength(5);
        expect(rule.custom!('12345')).toBeNull();
        expect(rule.custom!('123456')).not.toBeNull();
      });

      it('should allow empty values', () => {
        const rule = ValidationRules.maxLength(5);
        expect(rule.custom!('')).toBeNull();
      });
    });

    describe('number', () => {
      it('should validate numbers', () => {
        const rule = ValidationRules.number();
        expect(rule.custom!('123')).toBeNull();
        expect(rule.custom!(123)).toBeNull();
        expect(rule.custom!('12.34')).toBeNull();
      });

      it('should reject non-numbers', () => {
        const rule = ValidationRules.number();
        expect(rule.custom!('abc')).not.toBeNull();
        expect(rule.custom!('123abc')).not.toBeNull();
      });
    });

    describe('positiveNumber', () => {
      it('should validate positive numbers', () => {
        const rule = ValidationRules.positiveNumber();
        expect(rule.custom!('123')).toBeNull();
        expect(rule.custom!(123)).toBeNull();
        expect(rule.custom!('0.1')).toBeNull();
      });

      it('should reject zero and negative numbers', () => {
        const rule = ValidationRules.positiveNumber();
        expect(rule.custom!('0')).not.toBeNull();
        expect(rule.custom!(-123)).not.toBeNull();
      });
    });

    describe('url', () => {
      it('should validate URLs', () => {
        const rule = ValidationRules.url();
        expect(rule.custom!('https://example.com')).toBeNull();
        expect(rule.custom!('http://localhost:3000')).toBeNull();
      });

      it('should reject invalid URLs', () => {
        const rule = ValidationRules.url();
        expect(rule.custom!('not-a-url')).not.toBeNull();
        expect(rule.custom!('ftp://example.com')).not.toBeNull();
      });
    });

    describe('stellarAddress', () => {
      it('should validate valid Stellar addresses', () => {
        const rule = ValidationRules.stellarAddress();
        const validAddress = 'G' + 'A'.repeat(55);
        expect(rule.custom!(validAddress)).toBeNull();
      });

      it('should reject invalid Stellar addresses', () => {
        const rule = ValidationRules.stellarAddress();
        expect(rule.custom!('G123')).not.toBeNull();
        expect(rule.custom!('X' + 'A'.repeat(55))).not.toBeNull();
        expect(rule.custom!('G' + 'A'.repeat(54))).not.toBeNull();
      });
    });

    describe('stellarSecretKey', () => {
      it('should validate valid Stellar secret keys', () => {
        const rule = ValidationRules.stellarSecretKey();
        const validKey = 'S' + 'A'.repeat(55);
        expect(rule.custom!(validKey)).toBeNull();
      });

      it('should reject invalid Stellar secret keys', () => {
        const rule = ValidationRules.stellarSecretKey();
        expect(rule.custom!('S123')).not.toBeNull();
        expect(rule.custom!('X' + 'A'.repeat(55))).not.toBeNull();
        expect(rule.custom!('S' + 'A'.repeat(54))).not.toBeNull();
      });
    });
  });

  describe('validateField', () => {
    it('should validate required field', async () => {
      const rule = ValidationRules.required();
      const error = await validateField('', rule);
      expect(error).toBe('This field is required');
    });

    it('should validate email field', async () => {
      const rule = ValidationRules.email();
      const error = await validateField('invalid-email', rule);
      expect(error).not.toBeNull();
    });

    it('should return null for valid field', async () => {
      const rule = ValidationRules.email();
      const error = await validateField('test@example.com', rule);
      expect(error).toBeNull();
    });

    it('should handle async validators', async () => {
      const asyncValidator = ValidationRules.async(async (value) => {
        return value === 'taken' ? 'Already taken' : null;
      });
      const error = await validateField('taken', asyncValidator);
      expect(error).toBe('Already taken');
    });
  });

  describe('validateFields', () => {
    it('should validate multiple fields', async () => {
      const rules = {
        email: ValidationRules.email(),
        name: ValidationRules.required(),
        age: ValidationRules.positiveNumber()
      };

      const values = {
        email: 'invalid-email',
        name: '',
        age: -5
      };

      const errors = await validateFields(values, rules);
      expect(errors).toHaveProperty('email');
      expect(errors).toHaveProperty('name');
      expect(errors).toHaveProperty('age');
    });

    it('should return empty object for valid data', async () => {
      const rules = {
        email: ValidationRules.email(),
        name: ValidationRules.required()
      };

      const values = {
        email: 'test@example.com',
        name: 'John Doe'
      };

      const errors = await validateFields(values, rules);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
