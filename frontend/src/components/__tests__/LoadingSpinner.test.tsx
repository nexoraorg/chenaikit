import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { LoadingSpinner } from '../LoadingSpinner';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('components/LoadingSpinner', () => {
  // ─── default rendering ─────────────────────────────────────────────────────

  describe('default props', () => {
    it('renders without crashing', () => {
      renderWithTheme(<LoadingSpinner />);
    });

    it('renders a circular progress indicator by default', () => {
      renderWithTheme(<LoadingSpinner />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not render a message by default', () => {
      renderWithTheme(<LoadingSpinner />);
      expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
    });
  });

  // ─── variant ───────────────────────────────────────────────────────────────

  describe('variant prop', () => {
    it('renders CircularProgress for variant="circular"', () => {
      renderWithTheme(<LoadingSpinner variant="circular" />);
      // MUI CircularProgress has role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders LinearProgress for variant="linear"', () => {
      renderWithTheme(<LoadingSpinner variant="linear" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ─── message ───────────────────────────────────────────────────────────────

  describe('message prop', () => {
    it('renders the message when provided', () => {
      renderWithTheme(<LoadingSpinner message="Loading data…" />);
      expect(screen.getByText('Loading data…')).toBeInTheDocument();
    });

    it('does not render a message element when omitted', () => {
      renderWithTheme(<LoadingSpinner />);
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  // ─── fullScreen ────────────────────────────────────────────────────────────

  describe('fullScreen prop', () => {
    it('renders without crashing when fullScreen=true', () => {
      renderWithTheme(<LoadingSpinner fullScreen />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders without crashing when fullScreen=false', () => {
      renderWithTheme(<LoadingSpinner fullScreen={false} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ─── size prop ────────────────────────────────────────────────────────────

  describe('size prop', () => {
    it('renders with a custom numeric size', () => {
      renderWithTheme(<LoadingSpinner size={60} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders with a custom string size', () => {
      renderWithTheme(<LoadingSpinner size="5rem" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ─── combinations ─────────────────────────────────────────────────────────

  describe('prop combinations', () => {
    it('renders fullScreen circular spinner with a message', () => {
      renderWithTheme(
        <LoadingSpinner fullScreen variant="circular" message="Please wait" />
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });

    it('renders fullScreen linear spinner with a message', () => {
      renderWithTheme(
        <LoadingSpinner fullScreen variant="linear" message="Fetching…" />
      );
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Fetching…')).toBeInTheDocument();
    });
  });
});
