import { ValidationRule, FormFieldConfig, FormState, FormError } from '../form';

describe('Form Types', () => {
  describe('ValidationRule', () => {
    it('should create a basic validation rule', () => {
      const rule: ValidationRule = {
        required: true,
        minLength: 5,
        maxLength: 100,
        pattern: /^[a-zA-Z\s]+$/
      };

      expect(rule.required).toBe(true);
      expect(rule.minLength).toBe(5);
      expect(rule.maxLength).toBe(100);
      expect(rule.pattern).toBeInstanceOf(RegExp);
    });

    it('should create a validation rule with custom validator', () => {
      const customValidator = jest.fn().mockReturnValue(null);
      const rule: ValidationRule = {
        custom: customValidator
      };

      expect(rule.custom).toBeDefined();
      expect(typeof rule.custom).toBe('function');
    });

    it('should create a validation rule with async validator', () => {
      const asyncValidator = jest.fn().mockResolvedValue(null);
      const rule: ValidationRule = {
        async: asyncValidator
      };

      expect(rule.async).toBeDefined();
      expect(typeof rule.async).toBe('function');
    });
  });

  describe('FormFieldConfig', () => {
    it('should create a text field config', () => {
      const config: FormFieldConfig = {
        name: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'Enter username',
        required: true
      };

      expect(config.name).toBe('username');
      expect(config.label).toBe('Username');
      expect(config.type).toBe('text');
      expect(config.placeholder).toBe('Enter username');
      expect(config.required).toBe(true);
    });

    it('should create a select field config with options', () => {
      const config: FormFieldConfig = {
        name: 'country',
        label: 'Country',
        type: 'select',
        options: [
          { value: 'us', label: 'United States' },
          { value: 'uk', label: 'United Kingdom' }
        ]
      };

      expect(config.options).toHaveLength(2);
      expect(config.options?.[0].value).toBe('us');
      expect(config.options?.[0].label).toBe('United States');
    });
  });

  describe('FormError', () => {
    it('should create a validation error', () => {
      const error: FormError = {
        field: 'email',
        message: 'Invalid email format',
        type: 'validation'
      };

      expect(error.field).toBe('email');
      expect(error.message).toBe('Invalid email format');
      expect(error.type).toBe('validation');
    });

    it('should create an async error', () => {
      const error: FormError = {
        field: 'username',
        message: 'Username already taken',
        type: 'async'
      };

      expect(error.type).toBe('async');
    });
  });

  describe('FormState', () => {
    it('should create initial form state', () => {
      const state: FormState = {
        values: { username: '', email: '' },
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: false,
        isDirty: false
      };

      expect(state.values).toEqual({ username: '', email: '' });
      expect(state.errors).toEqual({});
      expect(state.isSubmitting).toBe(false);
      expect(state.isValid).toBe(false);
      expect(state.isDirty).toBe(false);
    });

    it('should represent form with errors', () => {
      const state: FormState = {
        values: { username: 'ab' },
        errors: { username: 'Too short' },
        touched: { username: true },
        isSubmitting: false,
        isValid: false,
        isDirty: true
      };

      expect(state.errors.username).toBe('Too short');
      expect(state.touched.username).toBe(true);
      expect(state.isDirty).toBe(true);
    });
  });

  describe('Form field types', () => {
    it('should support all field types', () => {
      const textConfig: FormFieldConfig = { name: 'text', label: 'Text', type: 'text' };
      const emailConfig: FormFieldConfig = { name: 'email', label: 'Email', type: 'email' };
      const passwordConfig: FormFieldConfig = { name: 'password', label: 'Password', type: 'password' };
      const numberConfig: FormFieldConfig = { name: 'age', label: 'Age', type: 'number' };
      const telConfig: FormFieldConfig = { name: 'phone', label: 'Phone', type: 'tel' };
      const urlConfig: FormFieldConfig = { name: 'website', label: 'Website', type: 'url' };
      const textareaConfig: FormFieldConfig = { name: 'bio', label: 'Bio', type: 'textarea' };
      const selectConfig: FormFieldConfig = { name: 'country', label: 'Country', type: 'select' };

      expect(textConfig.type).toBe('text');
      expect(emailConfig.type).toBe('email');
      expect(passwordConfig.type).toBe('password');
      expect(numberConfig.type).toBe('number');
      expect(telConfig.type).toBe('tel');
      expect(urlConfig.type).toBe('url');
      expect(textareaConfig.type).toBe('textarea');
      expect(selectConfig.type).toBe('select');
    });
  });
});
