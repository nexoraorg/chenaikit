import { ValidationRule } from '../types/form';

export function validateConfig(config: any): boolean {
  // TODO: Implement configuration validation - Issue #23
  throw new Error('Not implemented yet - see issue #23');
}

export function validateTransactionData(data: any): boolean {
  // TODO: Implement transaction data validation - Issue #23
  throw new Error('Not implemented yet - see issue #23');
}

// Common validation patterns
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    required: true,
    custom: (value) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return message;
      }
      return null;
    }
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return message;
      }
      return null;
    }
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    minLength: min,
    custom: (value) => {
      if (value && value.length < min) {
        return message || `Must be at least ${min} characters long`;
      }
      return null;
    }
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    maxLength: max,
    custom: (value) => {
      if (value && value.length > max) {
        return message || `Must be no more than ${max} characters long`;
      }
      return null;
    }
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    pattern: regex,
    custom: (value) => {
      if (value && !regex.test(value)) {
        return message;
      }
      return null;
    }
  }),

  number: (message = 'Please enter a valid number'): ValidationRule => ({
    custom: (value) => {
      if (value && isNaN(Number(value))) {
        return message;
      }
      return null;
    }
  }),

  positiveNumber: (message = 'Please enter a positive number'): ValidationRule => ({
    custom: (value) => {
      const num = Number(value);
      if (value && (isNaN(num) || num <= 0)) {
        return message;
      }
      return null;
    }
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    custom: (value) => {
      if (value) {
        try {
          new URL(value);
        } catch {
          return message;
        }
      }
      return null;
    }
  }),

  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    pattern: /^[+]?[1-9][\d]{0,15}$/,
    custom: (value) => {
      if (value && !/^[+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-()]/g, ''))) {
        return message;
      }
      return null;
    }
  }),

  // Blockchain-specific validations
  stellarAddress: (message = 'Please enter a valid Stellar address'): ValidationRule => ({
    custom: (value) => {
      if (value && !isValidStellarAddress(value)) {
        return message;
      }
      return null;
    }
  }),

  stellarSecretKey: (message = 'Please enter a valid Stellar secret key'): ValidationRule => ({
    custom: (value) => {
      if (value && !isValidStellarSecretKey(value)) {
        return message;
      }
      return null;
    }
  }),

  // Custom validators
  custom: (validator: (value: any) => string | null): ValidationRule => ({
    custom: validator
  }),

  async: (validator: (value: any) => Promise<string | null>): ValidationRule => ({
    async: validator
  })
};

// Helper functions for blockchain validations
function isValidStellarAddress(address: string): boolean {
  // Stellar addresses start with 'G' and are 56 characters long
  return /^G[A-Z0-9]{55}$/.test(address);
}

function isValidStellarSecretKey(secretKey: string): boolean {
  // Stellar secret keys start with 'S' and are 56 characters long
  return /^S[A-Z0-9]{55}$/.test(secretKey);
}

// Utility function to validate a single field
export async function validateField(value: any, rules: ValidationRule): Promise<string | null> {
  // Check required
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!value && !rules.required) {
    return null;
  }

  // Check minLength
  if (rules.minLength && value && value.length < rules.minLength) {
    return `Must be at least ${rules.minLength} characters long`;
  }

  // Check maxLength
  if (rules.maxLength && value && value.length > rules.maxLength) {
    return `Must be no more than ${rules.maxLength} characters long`;
  }

  // Check pattern
  if (rules.pattern && value && !rules.pattern.test(value)) {
    return 'Invalid format';
  }

  // Check custom validator
  if (rules.custom) {
    const error = rules.custom(value);
    if (error) return error;
  }

  // Check async validator
  if (rules.async) {
    const error = await rules.async(value);
    if (error) return error;
  }

  return null;
}

// Utility function to validate multiple fields
export async function validateFields(
  values: Record<string, any>,
  rules: Record<string, ValidationRule>
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const error = await validateField(values[field], fieldRules);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}