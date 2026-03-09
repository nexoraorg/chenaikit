import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FormError from '../FormError';

describe('FormError', () => {
  it('should not render when there is no error', () => {
    render(<FormError error={undefined} field="testField" />);
    
    const errorElement = screen.queryByRole('alert');
    expect(errorElement).not.toBeInTheDocument();
  });

  it('should not render when error is empty string', () => {
    render(<FormError error="" field="testField" />);
    
    const errorElement = screen.queryByRole('alert');
    expect(errorElement).not.toBeInTheDocument();
  });

  it('should render error message when error is provided', () => {
    render(<FormError error="This field is required" field="testField" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('This field is required');
  });

  it('should apply custom className', () => {
    render(<FormError error="Error message" field="testField" className="custom-error-class" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass('custom-error-class');
    expect(errorElement).toHaveClass('form-error');
  });

  it('should have proper accessibility attributes', () => {
    render(<FormError error="Error message" field="testField" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
    expect(errorElement).toHaveAttribute('aria-labelledby', 'testField-label');
  });

  it('should render error icon', () => {
    render(<FormError error="Error message" field="testField" />);
    
    const icon = screen.getByText('⚠️');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render error message in separate span', () => {
    render(<FormError error="Error message" field="testField" />);
    
    const message = screen.getByText('Error message');
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass('form-error__message');
  });

  it('should have correct structure', () => {
    const { container } = render(<FormError error="Error message" field="testField" />);
    
    const errorDiv = container.querySelector('.form-error');
    expect(errorDiv).toBeInTheDocument();
    
    const iconSpan = errorDiv?.querySelector('.form-error__icon');
    const messageSpan = errorDiv?.querySelector('.form-error__message');
    
    expect(iconSpan).toBeInTheDocument();
    expect(messageSpan).toBeInTheDocument();
    expect(iconSpan).toHaveTextContent('⚠️');
    expect(messageSpan).toHaveTextContent('Error message');
  });
});
