import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormError } from '../FormError';

describe('forms/FormError', () => {
  it('renders nothing when error is undefined', () => {
    render(<FormError error={undefined} field="email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when error is empty string', () => {
    render(<FormError error="" field="email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the error message', () => {
    render(<FormError error="Email is required" field="email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });

  it('applies custom className', () => {
    render(<FormError error="Oops" field="email" className="my-error" />);
    expect(screen.getByRole('alert')).toHaveClass('my-error', 'form-error');
  });

  it('sets aria-live="polite"', () => {
    render(<FormError error="Oops" field="email" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  it('sets aria-labelledby to field-label id', () => {
    render(<FormError error="Oops" field="email" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-labelledby', 'email-label');
  });

  it('sets id prop on the container', () => {
    render(<FormError error="Oops" field="email" id="error-email" />);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'error-email');
  });

  it('renders warning icon with aria-hidden', () => {
    render(<FormError error="Oops" field="email" />);
    const icon = screen.getByText('⚠️');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders message in form-error__message span', () => {
    render(<FormError error="Bad input" field="name" />);
    const msg = screen.getByText('Bad input');
    expect(msg).toHaveClass('form-error__message');
  });
});
