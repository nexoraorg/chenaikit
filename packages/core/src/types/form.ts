export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  async?: (value: any) => Promise<string | null>;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  validation?: ValidationRule;
  options?: Array<{ value: string; label: string }>; // For select fields
  disabled?: boolean;
}

export interface FormError {
  field: string;
  message: string;
  type: 'validation' | 'async' | 'submit';
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

export interface FormFieldProps {
  config: FormFieldConfig;
  value: any;
  error?: string;
  touched?: boolean;
  onChange: (value: any) => void;
  onBlur: () => void;
  onFocus: () => void;
  disabled?: boolean;
}

export interface FormErrorProps {
  error?: string;
  field: string;
  className?: string;
}

export interface UseFormValidationOptions {
  initialValues: Record<string, any>;
  validationRules: Record<string, ValidationRule>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export interface UseFormValidationReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  setValue: (field: string, value: any) => void;
  setError: (field: string, error: string) => void;
  setTouched: (field: string, touched: boolean) => void;
  handleChange: (field: string, value: any) => void;
  handleBlur: (field: string) => void;
  handleSubmit: (e?: any) => Promise<void>;
  reset: () => void;
  validateField: (field: string) => Promise<void>;
  validateForm: () => Promise<boolean>;
}
