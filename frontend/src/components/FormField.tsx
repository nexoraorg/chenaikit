import React, { forwardRef } from 'react';
import { FormFieldProps } from '@chenaikit/core';
import { FormError } from './FormError';

export const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FormFieldProps>(
  ({ 
    config, 
    value, 
    error, 
    touched, 
    onChange, 
    onBlur, 
    onFocus, 
    disabled = false 
  }, ref) => {
    const {
      name,
      label,
      type,
      placeholder,
      required,
      options = [],
      disabled: fieldDisabled = false
    } = config;

    const isDisabled = disabled || fieldDisabled;
    const hasError = touched && error;
    const fieldId = `field-${name}`;
    const errorId = `error-${name}`;

    // Common input props
    const commonProps = {
      id: fieldId,
      name,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        onChange(e.target.value);
      },
      onBlur,
      onFocus,
      disabled: isDisabled,
      'aria-invalid': !!hasError,
      'aria-describedby': hasError ? errorId : undefined,
      className: `form-field__input ${hasError ? 'form-field__input--error' : ''} ${isDisabled ? 'form-field__input--disabled' : ''}`
    };

    const renderInput = () => {
      switch (type) {
        case 'textarea':
          return (
            <textarea
              {...commonProps}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              placeholder={placeholder}
              rows={4}
              className={`${commonProps.className} form-field__textarea`}
            />
          );

        case 'select':
          return (
            <select
              {...commonProps}
              ref={ref as React.Ref<HTMLSelectElement>}
              className={`${commonProps.className} form-field__select`}
            >
              {placeholder && (
                <option value="" disabled>
                  {placeholder}
                </option>
              )}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );

        default:
          return (
            <input
              {...commonProps}
              ref={ref as React.Ref<HTMLInputElement>}
              type={type}
              placeholder={placeholder}
              className={`${commonProps.className} form-field__input--${type}`}
            />
          );
      }
    };

    return (
      <div className={`form-field ${hasError ? 'form-field--error' : ''} ${isDisabled ? 'form-field--disabled' : ''}`}>
        <label 
          htmlFor={fieldId}
          className="form-field__label"
          id={`${name}-label`}
        >
          {label}
          {required && (
            <span className="form-field__required" aria-label="required">
              *
            </span>
          )}
        </label>

        <div className="form-field__input-wrapper">
          {renderInput()}
          
          {/* Loading indicator for async validation */}
          {type === 'text' && name.includes('address') && (
            <div className="form-field__loading" aria-hidden="true">
              <span className="form-field__loading-spinner">⟳</span>
            </div>
          )}
        </div>

        <FormError 
          error={error}
          field={name}
          className="form-field__error"
        />
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
