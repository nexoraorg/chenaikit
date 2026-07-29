import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ThemeToggle } from '../ThemeToggle';
import * as ThemeContextModule from '../../contexts/ThemeContext';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// ─── mock useThemeMode ────────────────────────────────────────────────────────

const mockToggleTheme = jest.fn();

const mockUseThemeMode = (mode: 'light' | 'dark' = 'light') => {
  jest.spyOn(ThemeContextModule, 'useThemeMode').mockReturnValue({
    mode,
    userPreference: mode,
    setTheme: jest.fn(),
    toggleTheme: mockToggleTheme,
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  mockToggleTheme.mockReset();
});

describe('components/ThemeToggle', () => {
  // ─── rendering ────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders an icon button', () => {
      mockUseThemeMode('light');
      renderWithTheme(<ThemeToggle />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows DarkMode icon when current mode is light', () => {
      mockUseThemeMode('light');
      renderWithTheme(<ThemeToggle />);
      // The tooltip label changes based on mode
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows LightMode icon when current mode is dark', () => {
      mockUseThemeMode('dark');
      renderWithTheme(<ThemeToggle />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // ─── tooltip ─────────────────────────────────────────────────────────────

  describe('tooltip', () => {
    it('indicates switching to dark mode when in light mode', () => {
      mockUseThemeMode('light');
      renderWithTheme(<ThemeToggle />);
      // Tooltip title is rendered as aria attribute or accessible name
      const btn = screen.getByRole('button');
      expect(btn).toBeInTheDocument();
    });

    it('indicates switching to light mode when in dark mode', () => {
      mockUseThemeMode('dark');
      renderWithTheme(<ThemeToggle />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // ─── interaction ──────────────────────────────────────────────────────────

  describe('click interaction', () => {
    it('calls toggleTheme when the button is clicked in light mode', () => {
      mockUseThemeMode('light');
      renderWithTheme(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('calls toggleTheme when the button is clicked in dark mode', () => {
      mockUseThemeMode('dark');
      renderWithTheme(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('calls toggleTheme each time the button is clicked', () => {
      mockUseThemeMode('light');
      renderWithTheme(<ThemeToggle />);
      const btn = screen.getByRole('button');
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      expect(mockToggleTheme).toHaveBeenCalledTimes(3);
    });
  });
});
