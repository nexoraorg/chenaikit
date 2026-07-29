import type { CSSProperties } from 'react';
import type { ToastType, ToastPosition } from '../contexts/ToastContext';

// ─── Severity mapping ─────────────────────────────────────────────────────────

/**
 * Maps a ToastType to the MUI Alert severity string.
 * They share the same four values, but an explicit map keeps them decoupled.
 */
export const toastTypeToSeverity = (
  type: ToastType
): 'success' | 'error' | 'warning' | 'info' => type;

// ─── Accessible labels ────────────────────────────────────────────────────────

/** Returns a default ARIA label for each toast type. */
export const toastAriaLabel = (type: ToastType): string => {
  const labels: Record<ToastType, string> = {
    success: 'Success notification',
    error: 'Error notification',
    warning: 'Warning notification',
    info: 'Info notification',
  };
  return labels[type];
};

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Returns the progress-bar fill color for each toast type. */
export const toastProgressColor = (type: ToastType): string => {
  const colors: Record<ToastType, string> = {
    success: '#2e7d32', // MUI success.dark
    error: '#c62828',   // MUI error.dark
    warning: '#e65100', // MUI warning.dark
    info: '#01579b',    // MUI info.dark
  };
  return colors[type];
};

// ─── Position helpers ─────────────────────────────────────────────────────────

export interface AnchorPosition {
  vertical: 'top' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
}

/**
 * Converts a ToastPosition string into the vertical/horizontal anchor
 * format expected by MUI Snackbar.
 */
export const positionToAnchor = (position: ToastPosition): AnchorPosition => {
  const [vertical, horizontal] = position.split('-') as [
    'top' | 'bottom',
    'left' | 'center' | 'right'
  ];
  return { vertical, horizontal };
};

/**
 * Returns fixed CSS positioning for the toast stack container.
 *
 * NOTE: This object is passed directly to MUI's `sx` prop as a CSSProperties
 * value. Spacing values use explicit pixel strings (e.g. '8px') instead of
 * raw numbers to avoid MUI theme.spacing() multiplication, which would turn
 * gap:8 → 64px and padding:16 → 128px.
 */
export const stackAlignment = (position: ToastPosition): CSSProperties => {
  const [vertical, horizontal] = position.split('-') as [
    'top' | 'bottom',
    'left' | 'center' | 'right'
  ];

  // FIX: use string pixel values so MUI sx doesn't multiply them by
  // theme.spacing (default factor = 8). gap:8 → '8px', padding:16 → '16px'.
  const base: CSSProperties = {
    position: 'fixed',
    zIndex: 1400, // above MUI Dialog (z-index 1300)
    display: 'flex',
    flexDirection: vertical === 'top' ? 'column' : 'column-reverse',
    gap: '8px',
    maxWidth: 400,
    width: '100%',
    pointerEvents: 'none',
    padding: '16px',
  };

  if (vertical === 'top') {
    base.top = 0;
  } else {
    base.bottom = 0;
  }

  if (horizontal === 'left') {
    base.left = 0;
  } else if (horizontal === 'right') {
    base.right = 0;
  } else {
    base.left = '50%';
    base.transform = 'translateX(-50%)';
  }

  return base;
};

// ─── Progress math ────────────────────────────────────────────────────────────

/** Milliseconds remaining on a toast's auto-dismiss countdown. */
export const remainingDuration = (createdAt: number, duration: number): number => {
  const elapsed = Date.now() - createdAt;
  return Math.max(0, duration - elapsed);
};

/** Progress bar percentage (100 → 0) as time elapses. */
export const progressPercent = (createdAt: number, duration: number): number => {
  if (duration <= 0) return 0;
  const elapsed = Date.now() - createdAt;
  return Math.max(0, Math.min(100, ((duration - elapsed) / duration) * 100));
};

// ─── ID generator ────────────────────────────────────────────────────────────

export const createToastId = (prefix = 'toast'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
