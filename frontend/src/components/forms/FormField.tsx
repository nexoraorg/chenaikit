import React from 'react';
import {
  useController,
  UseControllerProps,
  FieldValues,
} from 'react-hook-form';
import { FormError } from './FormError';

export interface FormFieldProps<T extends FieldValues = FieldValues>
  extends UseControllerProps<T> {
  /** Visible label text */
  label: string;
  /** One of the standard HTML input types, plus 'textarea' and 'select' */
  type?: React.HTMLInputTypeAttribute | 'textarea' | 'select';
  placeholder?: string;
  disabled?: boolean;
  /** Options for select fields */
  options?: Array<{ value: string; label: string }>;
  className?: string;
  /** Show validation on change (default true) */
  validateOnChange?: boolean;
}

/**
 * Generic controlled `FormField` powered by React Hook Form.
 *
 * Supports: text, email, password, number, tel, url, textarea, select.
 * Validates in real-time (on change + on blur) and shows inline errors.
 */
export function FormField<T extends FieldValues = FieldValues>({
  label,
  type = 'text',
  placeholder,
  disabled = false,
  options = [],
  className = '',
  name,
  control,
  rules: validationRules,
  defaultValue,
}: FormFieldProps<T>) {
  const {
    field,
    fieldState: { error, isTouched },
  } = useController<T>({ name, control, rules: validationRules, defaultValue });

  const id = `field-${name as string}`;
  const errorId = `error-${name as string}`;
  const hasError = !!error;

  const baseClass = [
    'form-field__input',
    hasError ? 'form-field__input--error' : '',
    disabled ? 'form-field__input--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <textarea
          {...field}
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          rows={4}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`${baseClass} form-field__textarea`}
        />
      );
    }

    if (type === 'select') {
      return (
        <select
          {...field}
          id={id}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`${baseClass} form-field__select`}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        {...field}
        id={id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={`${baseClass} form-field__input--${type}`}
      />
    );
  };

  return (
    <div
      className={[
        'form-field',
        hasError ? 'form-field--error' : '',
        disabled ? 'form-field--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label
        htmlFor={id}
        id={`${name as string}-label`}
        className="form-field__label"
      >
        {label}
        {validationRules?.required && (
          <span className="form-field__required" aria-label="required">
            {' '}*
          </span>
        )}
      </label>

      <div className="form-field__input-wrapper">{renderInput()}</div>

      <FormError
        id={errorId}
        error={isTouched || hasError ? error?.message : undefined}
        field={name as string}
        className="form-field__error"
      />
    </div>
  );
}

export default FormField;
