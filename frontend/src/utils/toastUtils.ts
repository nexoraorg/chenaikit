import type { ToastType } from '../contexts/ToastContext';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

/**
 * Maps a toast type to the matching MUI Alert severity string.
 * MUI Alert uses the same four values, so this is a straight pass-through,
 * but having an explicit mapping keeps it decoupled.
 */
export const toastTypeToSeverity = (
  type: ToastType
): 'success' | 'error' | 'warning' | 'info' => type;

/**
 * Returns a default accessible ARIA label for each toast type.
 */
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

/**
 * Returns the MUI theme color token for each toast type's progress bar.
 */
export const toastProgressColor = (
  type: ToastType
): string => {
  const colors: Record<ToastType, string> = {
    success: '#2e7d32', // MUI success.dark
    error: '#c62828',   // MUI error.dark
    warning: '#e65100', // MUI warning.dark
    info: '#01579b',    // MUI info.dark
  };
  return colors[type];
};

// ─── Position helpers ─────────────────────────────────────────────────────────

import type { ToastPosition } from '../contexts/ToastContext';

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
 * Returns CSS positioning values for the toast stack container
 * so multiple toasts stack away from the screen edge cleanly.
 */
export const stackAlignment = (
  position: ToastPosition
): React.CSSProperties => {
  const [vertical, horizontal] = position.split('-') as [
    'top' | 'bottom',
    'left' | 'center' | 'right'
  ];

  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1400, // above MUI Dialog (1300)
    display: 'flex',
    flexDirection: vertical === 'top' ? 'column' : 'column-reverse',
    gap: 8,
    maxWidth: 400,
    width: '100%',
    pointerEvents: 'none',
    padding: 16,
  };

  // Vertical
  if (vertical === 'top') {
    base.top = 0;
  } else {
    base.bottom = 0;
  }

  // Horizontal
  if (horizontal === 'left') {
    base.left = 0;
  } else if (horizontal === 'right') {
    base.right = 0;
  } else {
    // center
    base.left = '50%';
    base.transform = 'translateX(-50%)';
  }

  return base;
};

// ─── Duration helpers ─────────────────────────────────────────────────────────

/**
 * Computes how many milliseconds remain on a toast's auto-dismiss countdown.
 */
export const remainingDuration = (createdAt: number, duration: number): number => {
  const elapsed = Date.now() - createdAt;
  return Math.max(0, duration - elapsed);
};

/**
 * Computes the progress bar width percentage (100 → 0 as time passes).
 */
export const progressPercent = (createdAt: number, duration: number): number => {
  if (duration <= 0) return 0;
  const elapsed = Date.now() - createdAt;
  return Math.max(0, Math.min(100, ((duration - elapsed) / duration) * 100));
};

// ─── ID generator (re-exported for tests) ────────────────────────────────────

export const createToastId = (prefix = 'toast'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
