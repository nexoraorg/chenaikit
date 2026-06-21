import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm } from 'react-hook-form';
import { FormField } from '../FormField';

function renderField(overrides: Partial<React.ComponentProps<typeof FormField>> = {}) {
  function Wrapper() {
    const { control } = useForm({ mode: 'onChange' });
    return (
      <FormField
        control={control}
        name="testField"
        label="Test Label"
        {...(overrides as any)}
      />
    );
  }
  return render(<Wrapper />);
}

describe('forms/FormField', () => {
  it('renders label and input', () => {
    renderField();
    expect(screen.getByLabelText(/test label/i)).toBeInTheDocument();
  });

  it('renders required asterisk when rules.required is set', () => {
    renderField({ rules: { required: 'Required' } });
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders a textarea when type="textarea"', () => {
    renderField({ type: 'textarea' });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a select when type="select"', () => {
    renderField({
      type: 'select',
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
      ],
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('renders an input with the given type', () => {
    renderField({ type: 'email' });
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('renders placeholder text', () => {
    renderField({ placeholder: 'Enter value here' });
    expect(screen.getByPlaceholderText('Enter value here')).toBeInTheDocument();
  });

  it('disables the input when disabled=true', () => {
    renderField({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows aria-invalid when there is an error', async () => {
    function Wrapper() {
      const { control, trigger } = useForm({ mode: 'onChange' });
      return (
        <>
          <FormField
            control={control}
            name="email"
            label="Email"
            type="email"
            rules={{ required: 'Email is required' }}
          />
          <button onClick={() => trigger('email')}>Validate</button>
        </>
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('shows error message after validation failure', async () => {
    function Wrapper() {
      const { control, trigger } = useForm({ mode: 'onChange' });
      return (
        <>
          <FormField
            control={control}
            name="email"
            label="Email"
            rules={{ required: 'Email is required' }}
          />
          <button onClick={() => trigger('email')}>Validate</button>
        </>
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByText('Validate'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
    });
  });
});
