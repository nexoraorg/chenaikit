import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm } from 'react-hook-form';
import { FormSubmit } from '../FormSubmit';

describe('forms/FormSubmit', () => {
  it('renders a submit button with default label', () => {
    function Inner() {
      const { control } = useForm();
      return <FormSubmit control={control} />;
    }
    render(<Inner />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('uses custom label', () => {
    function Inner() {
      const { control } = useForm();
      return <FormSubmit control={control} label="Send" />;
    }
    render(<Inner />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('renders reset button when onReset is provided', () => {
    const onReset = jest.fn();
    function Inner() {
      const { control } = useForm();
      return <FormSubmit control={control} onReset={onReset} />;
    }
    render(<Inner />);
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not render reset button when onReset is absent', () => {
    function Inner() {
      const { control } = useForm();
      return <FormSubmit control={control} />;
    }
    render(<Inner />);
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    function Inner() {
      const { control } = useForm();
      return <FormSubmit control={control} className="my-submit" />;
    }
    const { container } = render(<Inner />);
    expect(container.querySelector('.form-submit.my-submit')).toBeInTheDocument();
  });
});
