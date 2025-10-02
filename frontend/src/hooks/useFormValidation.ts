import { useState, useCallback, useRef, useEffect } from 'react';
import { UseFormValidationOptions, UseFormValidationReturn } from '@chenaikit/core';
import { validateField as validateFieldValue, validateFields } from '@chenaikit/core';

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useFormValidation({
  initialValues,
  validationRules,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  debounceMs = 300
}: UseFormValidationOptions): UseFormValidationReturn {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for debouncing
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingValidations = useRef<Set<string>>(new Set());

  // Debounced values for validation
  const debouncedValues = useDebounce(values, debounceMs);

  // Calculate if form is valid
  const isValid = Object.keys(errors).length === 0 && 
    Object.values(errors).every(error => !error);

  // Validate a single field
  const validateSingleField = useCallback(async (field: string, value: any) => {
    if (!validationRules[field]) return;

    try {
      const error = await validateFieldValue(value, validationRules[field]);
      setErrors(prev => ({
        ...prev,
        [field]: error || ''
      }));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [field]: 'Validation error occurred'
      }));
    }
  }, [validationRules]);

  // Debounced validation for real-time feedback
  const debouncedValidateField = useCallback((field: string, value: any) => {
    // Clear existing timeout
    if (debounceTimeouts.current[field]) {
      clearTimeout(debounceTimeouts.current[field]);
    }

    // Set new timeout
    debounceTimeouts.current[field] = setTimeout(() => {
      validateSingleField(field, value);
      pendingValidations.current.delete(field);
    }, debounceMs);
  }, [validateSingleField, debounceMs]);

  // Handle field value changes
  const handleChange = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);

    // Clear any existing error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Real-time validation with debouncing
    if (validateOnChange && validationRules[field]) {
      pendingValidations.current.add(field);
      debouncedValidateField(field, value);
    }
  }, [errors, validateOnChange, validationRules, debouncedValidateField]);

  // Handle field blur
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Immediate validation on blur
    if (validateOnBlur && validationRules[field]) {
      // Clear debounced validation
      if (debounceTimeouts.current[field]) {
        clearTimeout(debounceTimeouts.current[field]);
        delete debounceTimeouts.current[field];
      }

      // Validate immediately
      validateSingleField(field, values[field]);
    }
  }, [validateOnBlur, validationRules, validateSingleField, values]);

  // Validate all fields
  const validateForm = useCallback(async (): Promise<boolean> => {
    try {
      const newErrors = await validateFields(values, validationRules);
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    } catch (err) {
      console.error('Form validation error:', err);
      return false;
    }
  }, [values, validationRules]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setIsSubmitting(true);
    
    try {
      // Mark all fields as touched
      const allTouched = Object.keys(validationRules).reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setTouched(allTouched);

      // Validate form
      const isFormValid = await validateForm();
      
      if (isFormValid) {
        await onSubmit(values);
      }
    } catch (err) {
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validationRules, validateForm, onSubmit]);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsDirty(false);

    // Clear all debounce timeouts
    Object.values(debounceTimeouts.current).forEach(timeout => {
      clearTimeout(timeout);
    });
    debounceTimeouts.current = {};
    pendingValidations.current.clear();
  }, [initialValues]);

  // Set individual field value
  const setValue = useCallback((field: string, value: any) => {
    handleChange(field, value);
  }, [handleChange]);

  // Set individual field error
  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  // Set individual field touched state
  const setTouchedField = useCallback((field: string, touched: boolean) => {
    setTouched(prev => ({ ...prev, [field]: touched }));
  }, []);

  // Validate individual field
  const validateField = useCallback(async (field: string) => {
    if (validationRules[field]) {
      await validateFieldValue(field, values[field]);
    }
  }, [validationRules, validateFieldValue, values]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    setValue,
    setError,
    setTouched: setTouchedField,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    validateField,
    validateForm
  };
}

export default useFormValidation;
