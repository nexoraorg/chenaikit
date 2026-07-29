import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import Toast from '../Toast';
import type { Toast as ToastData } from '../../contexts/ToastContext';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// ─── factory helper ───────────────────────────────────────────────────────────

const makeToast = (overrides: Partial<ToastData> = {}): ToastData => ({
  id: 'toast-1',
  message: 'Test message',
  type: 'info',
  duration: 4000,
  position: 'bottom-left',
  action: { label: '', onClick: jest.fn() },
  showProgress: false,
  data: undefined,
  createdAt: Date.now(),
  dismissing: false,
  ...overrides,
});

describe('components/Toast', () => {
  // ─── rendering ────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the toast message', () => {
      renderWithTheme(<Toast toast={makeToast()} onDismiss={jest.fn()} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders a close (dismiss) button', () => {
      renderWithTheme(<Toast toast={makeToast()} onDismiss={jest.fn()} />);
      expect(
        screen.getByRole('button', { name: /dismiss notification/i })
      ).toBeInTheDocument();
    });

    it('renders with role="status" for accessibility', () => {
      renderWithTheme(<Toast toast={makeToast()} onDismiss={jest.fn()} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // ─── toast types ──────────────────────────────────────────────────────────

  describe('toast types', () => {
    (['success', 'error', 'warning', 'info'] as const).forEach((type) => {
      it(`renders a "${type}" toast without crashing`, () => {
        renderWithTheme(
          <Toast toast={makeToast({ type })} onDismiss={jest.fn()} />
        );
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('uses aria-live="assertive" for error toasts', () => {
      renderWithTheme(
        <Toast toast={makeToast({ type: 'error' })} onDismiss={jest.fn()} />
      );
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
    });

    it('uses aria-live="polite" for non-error toasts', () => {
      renderWithTheme(
        <Toast toast={makeToast({ type: 'info' })} onDismiss={jest.fn()} />
      );
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  // ─── dismiss button ───────────────────────────────────────────────────────

  describe('dismiss button', () => {
    it('calls onDismiss with the toast id when clicked', () => {
      const onDismiss = jest.fn();
      renderWithTheme(
        <Toast toast={makeToast({ id: 'toast-abc' })} onDismiss={onDismiss} />
      );
      fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
      expect(onDismiss).toHaveBeenCalledWith('toast-abc');
    });

    it('calls onDismiss exactly once per click', () => {
      const onDismiss = jest.fn();
      renderWithTheme(<Toast toast={makeToast()} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // ─── action button ────────────────────────────────────────────────────────

  describe('action button', () => {
    it('renders an action button when action.label is non-empty', () => {
      const toast = makeToast({
        action: { label: 'Undo', onClick: jest.fn() },
      });
      renderWithTheme(<Toast toast={toast} onDismiss={jest.fn()} />);
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    it('does not render an action button when action.label is empty', () => {
      renderWithTheme(
        <Toast toast={makeToast({ action: { label: '', onClick: jest.fn() } })} onDismiss={jest.fn()} />
      );
      expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    });

    it('calls action.onClick and onDismiss when action button is clicked', () => {
      const actionOnClick = jest.fn();
      const onDismiss = jest.fn();
      const toast = makeToast({
        id: 'action-toast',
        action: { label: 'Retry', onClick: actionOnClick },
      });
      renderWithTheme(<Toast toast={toast} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(actionOnClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith('action-toast');
    });
  });

  // ─── progress bar ─────────────────────────────────────────────────────────

  describe('progress bar', () => {
    it('renders a progress bar when showProgress=true and duration>0', () => {
      const { container } = renderWithTheme(
        <Toast
          toast={makeToast({ showProgress: true, duration: 4000 })}
          onDismiss={jest.fn()}
        />
      );
      // MUI LinearProgress renders with role="progressbar"
      // There are two progressbars if both alert + progress are present.
      // We check for at least one LinearProgress element
      const progressBars = container.querySelectorAll('[aria-hidden="true"]');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('does not render a progress bar when showProgress=false', () => {
      const { container } = renderWithTheme(
        <Toast
          toast={makeToast({ showProgress: false })}
          onDismiss={jest.fn()}
        />
      );
      const hiddenElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBe(0);
    });

    it('does not render a progress bar when duration=0', () => {
      const { container } = renderWithTheme(
        <Toast
          toast={makeToast({ showProgress: true, duration: 0 })}
          onDismiss={jest.fn()}
        />
      );
      const hiddenElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBe(0);
    });
  });

  // ─── dismissing animation ─────────────────────────────────────────────────

  describe('dismissing state', () => {
    it('renders when dismissing=false', () => {
      renderWithTheme(
        <Toast toast={makeToast({ dismissing: false })} onDismiss={jest.fn()} />
      );
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  // ─── rich messages ────────────────────────────────────────────────────────

  describe('rich messages', () => {
    it('renders a React element as the message', () => {
      const toast = makeToast({ message: <strong data-testid="rich">Bold</strong> });
      renderWithTheme(<Toast toast={toast} onDismiss={jest.fn()} />);
      expect(screen.getByTestId('rich')).toBeInTheDocument();
    });
  });
});
