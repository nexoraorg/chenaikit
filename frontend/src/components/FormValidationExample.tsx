import React, { useCallback, useMemo } from 'react';
import { 
  ValidationRules,
  FormFieldConfig 
} from '@chenaikit/core';
import { FormField as FormFieldComponent } from './FormField';
import { useFormValidation } from '../hooks/useFormValidation';
import { useTranslation } from 'react-i18next';

export const FormValidationExample: React.FC = () => {
  const { t } = useTranslation();

  // Async validation for checking if Stellar address exists
  const validateStellarAddressExists = useCallback(async (address: string): Promise<string | null> => {
    if (!address) return null;
    
    try {
      // Simulate API call to check if address exists
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation - in real implementation, you'd call Stellar Horizon API
      if (address === 'GINVALID123456789012345678901234567890123456789012345678901234567890') {
        return t('forms.stellarAddressNotExist', { defaultValue: 'This Stellar address does not exist' });
      }
      
      return null;
    } catch (error) {
      return t('forms.stellarAddressVerifyError', { defaultValue: 'Unable to verify address at this time' });
    }
  }, [t]);

  // Dynamic form configuration
  const formConfigs: FormFieldConfig[] = useMemo(() => [
    {
      name: 'email',
      label: t('profile.email'),
      type: 'email',
      placeholder: t('forms.emailPlaceholder', { defaultValue: 'Enter your email' }),
      required: true,
      validation: ValidationRules.email(t('forms.invalidEmail'))
    },
    {
      name: 'stellarAddress',
      label: t('forms.stellarAddressLabel', { defaultValue: 'Stellar Address' }),
      type: 'text',
      placeholder: t('forms.stellarAddressPlaceholder', { defaultValue: 'Enter your Stellar address (G...)' }),
      required: true,
      validation: ValidationRules.stellarAddress(t('forms.invalidStellarAddress', { defaultValue: 'Invalid Stellar address' }))
    },
    {
      name: 'amount',
      label: t('transactions.amount'),
      type: 'number',
      placeholder: t('forms.amountPlaceholder', { defaultValue: 'Enter amount' }),
      required: true,
      validation: ValidationRules.positiveNumber(t('forms.amountPositive', { defaultValue: 'Amount must be greater than 0' }))
    },
    {
      name: 'scheduledDate',
      label: t('forms.scheduledDateLabel', { defaultValue: 'Scheduled Date' }),
      type: 'date',
      required: true,
      minDate: new Date(),
      validation: ValidationRules.required(t('forms.scheduledDateRequired', { defaultValue: 'Please choose a scheduled date' }))
    },
    {
      name: 'scheduledTime',
      label: t('forms.scheduledTimeLabel', { defaultValue: 'Scheduled Time' }),
      type: 'time',
      required: true,
      minTime: '09:00',
      maxTime: '17:00',
      timeIntervalMinutes: 30,
      timeFormat: '12',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      validation: ValidationRules.required(t('forms.scheduledTimeRequired', { defaultValue: 'Please choose a scheduled time' }))
    },
    {
      name: 'memo',
      label: t('forms.memoLabel', { defaultValue: 'Memo (Optional)' }),
      type: 'textarea',
      placeholder: t('forms.memoPlaceholder', { defaultValue: 'Enter a memo for this transaction' }),
      validation: ValidationRules.maxLength(100, t('forms.maxLength', { count: 100 }))
    }
  ], [t]);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    reset
  } = useFormValidation({
    initialValues: {
      email: '',
      stellarAddress: '',
      amount: '',
      scheduledDate: '',
      scheduledTime: '',
      memo: ''
    },
    validationRules: {
      email: ValidationRules.email(t('forms.invalidEmail')),
      stellarAddress: ValidationRules.async(validateStellarAddressExists),
      amount: ValidationRules.positiveNumber(t('forms.amountPositive', { defaultValue: 'Amount must be greater than 0' })),
      scheduledDate: ValidationRules.required(t('forms.scheduledDateRequired', { defaultValue: 'Please choose a scheduled date' })),
      scheduledTime: ValidationRules.required(t('forms.scheduledTimeRequired', { defaultValue: 'Please choose a scheduled time' })),
      memo: ValidationRules.maxLength(100, t('forms.maxLength', { count: 100 }))
    },
    onSubmit: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(t('forms.submittedSuccessfully', { defaultValue: 'Form submitted successfully!' }));
    },
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300
  });

  return (
    <div className="form-validation-example" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>{t('forms.title', { defaultValue: 'Form Validation Example' })}</h2>
      <p>{t('forms.subtitle', { defaultValue: 'This example demonstrates real-time validation, debouncing, and blockchain address validation.' })}</p>
      
      <form onSubmit={handleSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {formConfigs.map((config) => (
          <FormFieldComponent
            key={config.name}
            config={config}
            value={values[config.name]}
            error={errors[config.name]}
            touched={touched[config.name]}
            onChange={(value: any) => handleChange(config.name, value)}
            onBlur={() => handleBlur(config.name)}
            onFocus={() => {}}
          />
        ))}
        
        <div className="form__actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            type="submit" 
            disabled={!isValid || isSubmitting}
            className="form__submit-button"
            style={{
              padding: '10px 20px',
              backgroundColor: isValid && !isSubmitting ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isValid && !isSubmitting ? 'pointer' : 'not-allowed'
            }}
          >
            {isSubmitting ? t('forms.submitting', { defaultValue: 'Submitting...' }) : t('forms.submit', { defaultValue: 'Submit Transaction' })}
          </button>
          
          <button 
            type="button" 
            onClick={reset}
            className="form__reset-button"
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {t('forms.reset', { defaultValue: 'Reset Form' })}
          </button>
        </div>
        
        <div className="form__status" style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <p><strong>{t('forms.status', { defaultValue: 'Form Status:' })}</strong></p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>{t('forms.valid', { defaultValue: 'Valid' })}: {isValid ? '✅' : '❌'}</li>
            <li>{t('forms.dirty', { defaultValue: 'Dirty' })}: {isDirty ? '✅' : '❌'}</li>
            <li>{t('forms.submittingLabel', { defaultValue: 'Submitting' })}: {isSubmitting ? '✅' : '❌'}</li>
          </ul>
        </div>
      </form>
    </div>
  );
};

export default FormValidationExample;
