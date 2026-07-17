import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ThemeToggle } from '../components/ThemeToggle';
import { ThemeProvider } from '../contexts/ThemeContext';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('ThemeToggle accessibility', () => {
  it('exposes an accessible name for screen readers', () => {
    renderWithTheme(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to (dark|light) mode/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithTheme(<ThemeToggle />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
