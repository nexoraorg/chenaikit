import React from 'react';

export interface FormErrorProps {
  error?: string;
  field: string;
  /** DOM id so input can reference with aria-describedby */
  id?: string;
  className?: string;
}

/**
 * Accessible inline error message for form fields.
 * Renders nothing when `error` is falsy.
 */
export const FormError: React.FC<FormErrorProps> = ({
  error,
  field,
  id,
  className = '',
}) => {
  if (!error) return null;

  return (
    <div
      id={id}
      className={`form-error ${className}`.trim()}
      role="alert"
      aria-live="polite"
      aria-labelledby={`${field}-label`}
    >
      <span className="form-error__icon" aria-hidden="true">
        ⚠️
      </span>
      <span className="form-error__message">{error}</span>
    </div>
  );
};

export default FormError;
