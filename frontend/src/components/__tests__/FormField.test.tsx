import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormField from '../FormField';
import FormError from '../FormError';

// Mock FormError component
jest.mock('../FormError', () => ({
  __esModule: true,
  default: ({ error, field, className }: { error?: string; field: string; className?: string }) => {
    if (!error) return null;
    return (
      <div 
        className={`form-error ${className}`}
        role="alert"
        aria-live="polite"
        aria-labelledby={`${field}-label`}
        data-testid="form-error"
      >
        <span className="form-error__icon" aria-hidden="true">
          ⚠️
        </span>
        <span className="form-error__message">
          {error}
        </span>
      </div>
    );
  },
}));

describe('FormField', () => {
  const mockConfig = {
    name: 'testField',
    label: 'Test Field',
    type: 'text' as const,
  };

  const defaultProps = {
    config: mockConfig,
    value: '',
    error: undefined,
    touched: false,
    onChange: jest.fn(),
    onBlur: jest.fn(),
    onFocus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render a text input by default', () => {
      render(<FormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('name', 'testField');
      expect(input).toHaveAttribute('id', 'field-testField');
    });

    it('should render label correctly', () => {
      render(<FormField {...defaultProps} />);
      
      const label = screen.getByText('Test Field');
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute('for', 'field-testField');
      expect(label).toHaveAttribute('id', 'testField-label');
    });

    it('should render required indicator when required', () => {
      const configWithRequired = { ...mockConfig, required: true };
      render(<FormField {...defaultProps} config={configWithRequired} />);
      
      const requiredIndicator = screen.getByLabelText('required');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveTextContent('*');
    });

    it('should render placeholder when provided', () => {
      const configWithPlaceholder = { ...mockConfig, placeholder: 'Enter text here' };
      render(<FormField {...defaultProps} config={configWithPlaceholder} />);
      
      const input = screen.getByPlaceholderText('Enter text here');
      expect(input).toBeInTheDocument();
    });

    it('should render textarea when type is textarea', () => {
      const configWithTextarea = { ...mockConfig, type: 'textarea' as const };
      render(<FormField {...defaultProps} config={configWithTextarea} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render select when type is select', () => {
      const configWithSelect = {
        ...mockConfig,
        type: 'select' as const,
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ],
      };
      render(<FormField {...defaultProps} config={configWithSelect} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('should render placeholder option for select when provided', () => {
      const configWithSelect = {
        ...mockConfig,
        type: 'select' as const,
        placeholder: 'Choose an option',
        options: [{ value: 'option1', label: 'Option 1' }],
      };
      render(<FormField {...defaultProps} config={configWithSelect} />);
      
      const placeholderOption = screen.getByText('Choose an option');
      expect(placeholderOption).toBeInTheDocument();
      expect(placeholderOption).toHaveAttribute('disabled');
    });
  });

  describe('Value handling', () => {
    it('should pass value to input', () => {
      render(<FormField {...defaultProps} value="test value" />);
      
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('test value');
    });

    it('should handle empty value', () => {
      render(<FormField {...defaultProps} value={undefined} />);
      
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should call onChange when input value changes', () => {
      const mockOnChange = jest.fn();
      render(<FormField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('new value');
    });
  });

  describe('Error handling', () => {
    it('should show error when touched and has error', () => {
      render(<FormField {...defaultProps} touched={true} error="Field is required" />);
      
      const error = screen.getByTestId('form-error');
      expect(error).toBeInTheDocument();
      expect(error).toHaveTextContent('Field is required');
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'error-testField');
    });

    it('should not show error when not touched', () => {
      render(<FormField {...defaultProps} touched={false} error="Field is required" />);
      
      const error = screen.queryByTestId('form-error');
      expect(error).not.toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('should not show error when no error', () => {
      render(<FormField {...defaultProps} touched={true} error={undefined} />);
      
      const error = screen.queryByTestId('form-error');
      expect(error).not.toBeInTheDocument();
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should apply error class names', () => {
      render(<FormField {...defaultProps} touched={true} error="Error message" />);
      
      const formField = screen.getByTestId('form-field')?.parentElement;
      const input = screen.getByRole('textbox');
      
      expect(formField).toHaveClass('form-field--error');
      expect(input).toHaveClass('form-field__input--error');
    });
  });

  describe('Disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      render(<FormField {...defaultProps} disabled={true} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should disable input when field config disabled is true', () => {
      const configWithDisabled = { ...mockConfig, disabled: true };
      render(<FormField {...defaultProps} config={configWithDisabled} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should apply disabled class names', () => {
      render(<FormField {...defaultProps} disabled={true} />);
      
      const formField = screen.getByTestId('form-field')?.parentElement;
      const input = screen.getByRole('textbox');
      
      expect(formField).toHaveClass('form-field--disabled');
      expect(input).toHaveClass('form-field__input--disabled');
    });
  });

  describe('Event handlers', () => {
    it('should call onBlur when input loses focus', () => {
      const mockOnBlur = jest.fn();
      render(<FormField {...defaultProps} onBlur={mockOnBlur} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      
      expect(mockOnBlur).toHaveBeenCalledTimes(1);
    });

    it('should call onFocus when input gains focus', () => {
      const mockOnFocus = jest.fn();
      render(<FormField {...defaultProps} onFocus={mockOnFocus} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      
      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Address field loading indicator', () => {
    it('should show loading indicator for address fields', () => {
      const configWithAddress = { ...mockConfig, name: 'address' };
      render(<FormField {...defaultProps} config={configWithAddress} />);
      
      const loadingIndicator = screen.getByText('⟳');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveClass('form-field__loading-spinner');
    });

    it('should not show loading indicator for non-address fields', () => {
      const configWithName = { ...mockConfig, name: 'username' };
      render(<FormField {...defaultProps} config={configWithName} />);
      
      const loadingIndicator = screen.queryByText('⟳');
      expect(loadingIndicator).not.toBeInTheDocument();
    });

    it('should not show loading indicator for non-text address fields', () => {
      const configWithAddressSelect = { ...mockConfig, name: 'address', type: 'select' as const };
      render(<FormField {...defaultProps} config={configWithAddressSelect} />);
      
      const loadingIndicator = screen.queryByText('⟳');
      expect(loadingIndicator).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<FormField {...defaultProps} touched={true} error="Error message" />);
      
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Field');
      const error = screen.getByTestId('form-error');
      
      expect(input).toHaveAttribute('aria-describedby', 'error-testField');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(label).toHaveAttribute('id', 'testField-label');
      expect(error).toHaveAttribute('aria-live', 'polite');
      expect(error).toHaveAttribute('role', 'alert');
      expect(error).toHaveAttribute('aria-labelledby', 'testField-label');
    });

    it('should have proper ARIA attributes for required field', () => {
      const configWithRequired = { ...mockConfig, required: true };
      render(<FormField {...defaultProps} config={configWithRequired} />);
      
      const requiredIndicator = screen.getByLabelText('required');
      expect(requiredIndicator).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper ARIA attributes for loading indicator', () => {
      const configWithAddress = { ...mockConfig, name: 'address' };
      render(<FormField {...defaultProps} config={configWithAddress} />);
      
      const loadingIndicator = screen.getByText('⟳');
      expect(loadingIndicator).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
