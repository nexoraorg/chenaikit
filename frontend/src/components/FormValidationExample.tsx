import React from 'react';
import { 
  ValidationRules,
  FormFieldConfig 
} from '@chenaikit/core';
import { FormField as FormFieldComponent } from './FormField';
import { useFormValidation } from '../hooks/useFormValidation';

// Example form configuration
const formConfigs: FormFieldConfig[] = [
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your email',
    required: true,
    validation: ValidationRules.email()
  },
  {
    name: 'stellarAddress',
    label: 'Stellar Address',
    type: 'text',
    placeholder: 'Enter your Stellar address (G...)',
    required: true,
    validation: ValidationRules.stellarAddress()
  },
  {
    name: 'amount',
    label: 'Amount',
    type: 'number',
    placeholder: 'Enter amount',
    required: true,
    validation: ValidationRules.positiveNumber('Amount must be greater than 0')
  },
  {
    name: 'memo',
    label: 'Memo (Optional)',
    type: 'textarea',
    placeholder: 'Enter a memo for this transaction',
    validation: ValidationRules.maxLength(100, 'Memo must be less than 100 characters')
  }
];

// Example async validation for checking if Stellar address exists
const validateStellarAddressExists = async (address: string): Promise<string | null> => {
  if (!address) return null;
  
  try {
    // Simulate API call to check if address exists
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock validation - in real implementation, you'd call Stellar Horizon API
    if (address === 'GINVALID123456789012345678901234567890123456789012345678901234567890') {
      return 'This Stellar address does not exist';
    }
    
    return null;
  } catch (error) {
    return 'Unable to verify address at this time';
  }
};

export const FormValidationExample: React.FC = () => {
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
      memo: ''
    },
    validationRules: {
      email: ValidationRules.email(),
      stellarAddress: ValidationRules.async(validateStellarAddressExists),
      amount: ValidationRules.positiveNumber(),
      memo: ValidationRules.maxLength(100)
    },
    onSubmit: async (values: Record<string, any>) => {
      console.log('Form submitted with values:', values);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Form submitted successfully!');
    },
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300
  });

  return (
    <div className="form-validation-example" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Form Validation Example</h2>
      <p>This example demonstrates real-time validation, debouncing, and blockchain address validation.</p>
      
      <form onSubmit={handleSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {formConfigs.map((config) => (
          <FormFieldComponent
            key={config.name}
            config={config}
            value={values[config.name]}
            error={errors[config.name]}
            touched={touched[config.name]}
            onChange={(value) => handleChange(config.name, value)}
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
            {isSubmitting ? 'Submitting...' : 'Submit Transaction'}
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
            Reset Form
          </button>
        </div>
        
        <div className="form__status" style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <p><strong>Form Status:</strong></p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Valid: {isValid ? '✅' : '❌'}</li>
            <li>Dirty: {isDirty ? '✅' : '❌'}</li>
            <li>Submitting: {isSubmitting ? '✅' : '❌'}</li>
          </ul>
        </div>
      </form>
    </div>
  );
};

export default FormValidationExample;
