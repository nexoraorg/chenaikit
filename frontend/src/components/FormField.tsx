import React, { forwardRef } from 'react';
import { FormFieldProps } from '@chenaikit/core';
import { DatePicker } from './DatePicker';
import { DateRangePicker } from './DateRangePicker';
import { DateTimePicker, DateTimeValue } from './DateTimePicker';
import { FormError } from './FormError';

const formatDateFieldValue = (date: Date | null): string => {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
      disabled: fieldDisabled = false,
      minDate,
      maxDate,
      disabledDates,
      minTime,
      maxTime,
      timeIntervalMinutes,
      timeFormat,
      timezone
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
        case 'date':
          return (
            <DatePicker
              value={value || null}
              onChange={(date) => onChange(formatDateFieldValue(date))}
              label={label}
              name={name}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
              disabled={isDisabled}
              required={required}
              error={!!hasError}
              helperText={hasError ? error : undefined}
              placeholder={placeholder}
              onBlur={onBlur}
            />
          );

        case 'time':
          return (
            <DateTimePicker
              value={{ date: null, time: value || null, timezone }}
              onChange={(nextValue: DateTimeValue) => onChange(nextValue.time || '')}
              mode="time"
              label={label}
              timezone={timezone}
              intervalMinutes={timeIntervalMinutes}
              minTime={minTime}
              maxTime={maxTime}
              timeFormat={timeFormat}
              disabled={isDisabled}
              required={required}
              error={!!hasError}
              helperText={hasError ? error : undefined}
              onBlur={onBlur}
            />
          );

        case 'datetime':
        case 'datetime-local':
          return (
            <DateTimePicker
              value={value || { date: null, time: null, timezone }}
              onChange={onChange}
              mode="datetime"
              label={label}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
              timezone={timezone}
              intervalMinutes={timeIntervalMinutes}
              minTime={minTime}
              maxTime={maxTime}
              timeFormat={timeFormat}
              disabled={isDisabled}
              required={required}
              error={!!hasError}
              helperText={hasError ? error : undefined}
              onBlur={onBlur}
            />
          );

        case 'date-range':
          return (
            <DateRangePicker
              value={value || { start: null, end: null }}
              onChange={onChange}
              startLabel={`${label} start`}
              endLabel={`${label} end`}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
              disabled={isDisabled}
              required={required}
              error={!!hasError}
              helperText={hasError ? error : undefined}
              onBlur={onBlur}
            />
          );

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
              {options.map((option: { value: string; label: string }) => (
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

    const usesPicker = type === 'date' || type === 'time' || type === 'datetime' || type === 'datetime-local' || type === 'date-range';

    return (
      <div className={`form-field ${hasError ? 'form-field--error' : ''} ${isDisabled ? 'form-field--disabled' : ''}`}>
        {!usesPicker && (
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
        )}

        <div className="form-field__input-wrapper">
          {renderInput()}
          
          {/* Loading indicator for async validation */}
          {type === 'text' && name.includes('address') && (
            <div className="form-field__loading" aria-hidden="true">
              <span className="form-field__loading-spinner">⟳</span>
            </div>
          )}
        </div>

        {!usesPicker && (
          <FormError 
            error={error}
            field={name}
            className="form-field__error"
          />
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
