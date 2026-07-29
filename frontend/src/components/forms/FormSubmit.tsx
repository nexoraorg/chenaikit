import React from 'react';
import { useFormState, UseFormStateProps, FieldValues } from 'react-hook-form';

export interface FormSubmitProps<T extends FieldValues = FieldValues>
  extends Pick<UseFormStateProps<T>, 'control'> {
  /** Button label when idle */
  label?: string;
  /** Button label while submitting */
  labelSubmitting?: string;
  /** Disable the button when the form is invalid (default true) */
  disableWhenInvalid?: boolean;
  className?: string;
  /** Optional reset handler */
  onReset?: () => void;
  /** Label for the optional reset button */
  resetLabel?: string;
}

/**
 * Submit button that:
 * - is disabled while the form is submitting or invalid,
 * - shows a "Submitting…" label during async submission,
 * - optionally renders a Reset button.
 */
export function FormSubmit<T extends FieldValues = FieldValues>({
  control,
  label = 'Submit',
  labelSubmitting = 'Submitting…',
  disableWhenInvalid = true,
  className = '',
  onReset,
  resetLabel = 'Reset',
}: FormSubmitProps<T>) {
  const { isSubmitting, isValid } = useFormState({ control });

  const isDisabled = isSubmitting || (disableWhenInvalid && !isValid);

  return (
    <div className={`form-submit ${className}`.trim()}>
      <button
        type="submit"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isSubmitting}
        className={[
          'form-submit__button',
          isDisabled ? 'form-submit__button--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isSubmitting ? labelSubmitting : label}
      </button>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={isSubmitting}
          className="form-submit__reset"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}

export default FormSubmit;
