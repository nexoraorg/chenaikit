# Form Validation System

A robust form validation system with real-time validation, error handling, and user-friendly feedback for all user input forms in ChenAIKit.

## Features

- ✅ **Real-time validation** with debouncing
- ✅ **Custom validation rules** for common patterns
- ✅ **Blockchain address validation** (Stellar)
- ✅ **Async validation** support
- ✅ **Accessibility** features for screen readers
- ✅ **Mobile-friendly** form interactions
- ✅ **Loading states** for form submission
- ✅ **TypeScript** support with full type safety

## Architecture

The form validation system is split between two packages:

- **`@chenaikit/core`**: TypeScript utilities and validation logic
- **`@chenaikit/frontend`**: React components and hooks

## Core Package (`@chenaikit/core`)

### Validation Rules

```typescript
import { ValidationRules } from '@chenaikit/core';

// Common validations
const emailRule = ValidationRules.email('Please enter a valid email');
const requiredRule = ValidationRules.required('This field is required');
const minLengthRule = ValidationRules.minLength(8, 'Must be at least 8 characters');
const maxLengthRule = ValidationRules.maxLength(100, 'Must be less than 100 characters');
const numberRule = ValidationRules.number('Please enter a valid number');
const positiveNumberRule = ValidationRules.positiveNumber('Must be greater than 0');
const urlRule = ValidationRules.url('Please enter a valid URL');
const phoneRule = ValidationRules.phone('Please enter a valid phone number');

// Blockchain-specific validations
const stellarAddressRule = ValidationRules.stellarAddress('Please enter a valid Stellar address');
const stellarSecretKeyRule = ValidationRules.stellarSecretKey('Please enter a valid Stellar secret key');

// Custom validations
const customRule = ValidationRules.custom((value) => {
  if (value === 'invalid') return 'This value is not allowed';
  return null;
});

// Async validations
const asyncRule = ValidationRules.async(async (value) => {
  const exists = await checkIfExists(value);
  return exists ? null : 'This value does not exist';
});
```

### Validation Functions

```typescript
import { validateField, validateFields } from '@chenaikit/core';

// Validate a single field
const error = await validateField('test@example.com', ValidationRules.email());

// Validate multiple fields
const errors = await validateFields(
  { email: 'test@example.com', name: 'John' },
  { 
    email: ValidationRules.email(), 
    name: ValidationRules.required() 
  }
);
```

## Frontend Package (`@chenaikit/frontend`)

### FormField Component

```typescript
import { FormField } from '@chenaikit/frontend';

const MyForm = () => {
  return (
    <FormField
      config={{
        name: 'email',
        label: 'Email Address',
        type: 'email',
        placeholder: 'Enter your email',
        required: true,
        validation: ValidationRules.email()
      }}
      value={email}
      error={emailError}
      touched={emailTouched}
      onChange={setEmail}
      onBlur={() => setEmailTouched(true)}
      onFocus={() => {}}
    />
  );
};
```

### useFormValidation Hook

```typescript
import { useFormValidation } from '@chenaikit/frontend';

const MyForm = () => {
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
      password: '',
      stellarAddress: ''
    },
    validationRules: {
      email: ValidationRules.email(),
      password: ValidationRules.minLength(8),
      stellarAddress: ValidationRules.stellarAddress()
    },
    onSubmit: async (values) => {
      console.log('Form submitted:', values);
    },
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

## Form Field Types

The system supports various input types:

- `text` - Standard text input
- `email` - Email input with validation
- `password` - Password input
- `number` - Number input
- `tel` - Telephone input
- `url` - URL input
- `textarea` - Multi-line text input
- `select` - Dropdown selection

## Validation Features

### Real-time Validation

Validation occurs as users type with configurable debouncing:

```typescript
const { handleChange } = useFormValidation({
  // ... other options
  validateOnChange: true,
  debounceMs: 300 // Wait 300ms after user stops typing
});
```

### Async Validation

Support for server-side validation:

```typescript
const asyncValidationRule = ValidationRules.async(async (value) => {
  try {
    const response = await fetch(`/api/validate/${value}`);
    const result = await response.json();
    return result.valid ? null : 'Validation failed';
  } catch {
    return 'Unable to validate at this time';
  }
});
```

### Custom Validation

Create custom validation logic:

```typescript
const customRule = ValidationRules.custom((value) => {
  if (value && value.length < 3) {
    return 'Must be at least 3 characters';
  }
  if (value && !/^[A-Z]/.test(value)) {
    return 'Must start with uppercase letter';
  }
  return null;
});
```

## Accessibility Features

- **ARIA attributes** for screen readers
- **Error announcements** with `role="alert"`
- **Field associations** with `aria-describedby`
- **Focus management** for keyboard navigation
- **High contrast** mode support
- **Reduced motion** support

## Mobile Support

- **Touch-friendly** input sizes
- **Prevents zoom** on iOS with proper font sizes
- **Responsive design** for all screen sizes
- **Gesture support** for form interactions

## Styling

The system includes comprehensive CSS with:

- **Modern design** with smooth transitions
- **Error states** with clear visual feedback
- **Loading indicators** for async operations
- **Responsive breakpoints** for mobile devices
- **Accessibility improvements** for all users

## Example Usage

See `frontend/src/components/FormValidationExample.tsx` for a complete working example that demonstrates:

- Email validation
- Stellar address validation with async checking
- Number validation
- Textarea with length limits
- Form submission with loading states
- Real-time validation feedback

## TypeScript Support

Full TypeScript support with:

- **Type-safe** validation rules
- **IntelliSense** for form configurations
- **Generic types** for form values
- **Error type definitions** for validation errors

## Performance

- **Debounced validation** to prevent excessive API calls
- **Memoized callbacks** to prevent unnecessary re-renders
- **Efficient error state management**
- **Cleanup** of timeouts and subscriptions

## Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge)
- **Mobile browsers** (iOS Safari, Chrome Mobile)
- **Accessibility tools** (Screen readers, keyboard navigation)
- **Progressive enhancement** for older browsers
