import React from 'react';
import { FormErrorProps } from '@chenaikit/core';

export const FormError: React.FC<FormErrorProps> = ({ 
  error, 
  field, 
  className = '' 
}) => {
  if (!error) return null;

  return (
    <div 
      className={`form-error ${className}`}
      role="alert"
      aria-live="polite"
      aria-labelledby={`${field}-label`}
    >
      <span className="form-error__icon" aria-hidden="true">
        ⚠️
      </span>
      <span className="form-error__message">
        {error}
      </span>
    </div>
  );
};

export default FormError;
