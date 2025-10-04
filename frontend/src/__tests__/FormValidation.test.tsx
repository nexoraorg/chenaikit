import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormValidationExample from '../components/FormValidationExample';

// Mock the core package
jest.mock('@chenaikit/core', () => ({
  ValidationRules: {
    email: () => ({
      custom: (value: any) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      }
    }),
    stellarAddress: () => ({
      custom: (value: any) => {
        if (value && !/^G[A-Z0-9]{55}$/.test(value)) {
          return 'Please enter a valid Stellar address';
        }
        return null;
      }
    }),
    positiveNumber: () => ({
      custom: (value: any) => {
        const num = Number(value);
        if (value && (isNaN(num) || num <= 0)) {
          return 'Amount must be greater than 0';
        }
        return null;
      }
    }),
    maxLength: (max: number) => ({
      custom: (value: any) => {
        if (value && value.length > max) {
          return `Must be no more than ${max} characters long`;
        }
        return null;
      }
    }),
    async: (validator: any) => validator
  },
  validateField: jest.fn(),
  validateFields: jest.fn()
}));

describe('FormValidationExample', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form fields correctly', () => {
    render(<FormValidationExample />);
    
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/stellar address/i)).toBeTruthy();
    expect(screen.getByLabelText(/amount/i)).toBeTruthy();
    expect(screen.getByLabelText(/memo/i)).toBeTruthy();
  });

  test('shows validation errors for invalid input', async () => {
    render(<FormValidationExample />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /submit transaction/i });
    
    // Enter invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    // Click submit to trigger validation
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeTruthy();
    });
  });

  test('validates Stellar address format', async () => {
    render(<FormValidationExample />);
    
    const stellarInput = screen.getByLabelText(/stellar address/i);
    
    // Enter invalid Stellar address
    fireEvent.change(stellarInput, { target: { value: 'invalid-address' } });
    fireEvent.blur(stellarInput);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid stellar address/i)).toBeTruthy();
    });
  });

  test('validates positive numbers', async () => {
    render(<FormValidationExample />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    
    // Enter negative number
    fireEvent.change(amountInput, { target: { value: '-10' } });
    fireEvent.blur(amountInput);
    
    await waitFor(() => {
      expect(screen.getByText(/amount must be greater than 0/i)).toBeTruthy();
    });
  });

  test('validates text length limits', async () => {
    render(<FormValidationExample />);
    
    const memoInput = screen.getByLabelText(/memo/i);
    const longText = 'a'.repeat(101); // 101 characters
    
    // Enter text that's too long
    fireEvent.change(memoInput, { target: { value: longText } });
    fireEvent.blur(memoInput);
    
    await waitFor(() => {
      expect(screen.getByText(/must be no more than 100 characters long/i)).toBeTruthy();
    });
  });

  test('enables submit button when form is valid', async () => {
    render(<FormValidationExample />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const stellarInput = screen.getByLabelText(/stellar address/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole('button', { name: /submit transaction/i });
    
    // Enter valid values
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(stellarInput, { target: { value: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012345678901234567890' } });
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Wait for validation to complete
    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  test('resets form when reset button is clicked', () => {
    render(<FormValidationExample />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const resetButton = screen.getByRole('button', { name: /reset form/i });
    
    // Enter some value
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect((emailInput as HTMLInputElement).value).toBe('test@example.com');
    
    // Click reset
    fireEvent.click(resetButton);
    expect((emailInput as HTMLInputElement).value).toBe('');
  });
});
