import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner accessibility', () => {
  it('exposes a polite live status region', () => {
    render(<LoadingSpinner message="Loading profile" />);
    expect(screen.getByRole('status', { name: /loading profile/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<LoadingSpinner message="Loading" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
