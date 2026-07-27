import { useEffect, useRef } from 'react';
import {
  useKeyboardShortcutContext,
  formatShortcutCombo,
} from '../contexts/KeyboardShortcutContext';
import type { ShortcutCombo } from '../contexts/KeyboardShortcutContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseKeyboardShortcutOptions {
  /** Human-readable description for the help dialog */
  description: string;
  /** Category for grouping in help dialog */
  category?: string;
  /** Whether this shortcut is enabled. Defaults to true. */
  enabled?: boolean;
  /** Whether to prevent default browser behavior. Defaults to true. */
  preventDefault?: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Register a keyboard shortcut.
 *
 * Usage:
 * ```tsx
 * useKeyboardShortcut(
 *   { key: 'Escape' },
 *   () => closeModal(),
 *   { description: 'Close the current dialog', category: 'Navigation' }
 * );
 *
 * useKeyboardShortcut(
 *   { key: 'k', ctrlKey: true },
 *   () => openCommandPalette(),
 *   { description: 'Open command palette', category: 'General' }
 * );
 * ```
 */
const useKeyboardShortcut = (
  combo: ShortcutCombo,
  handler: (e: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions
): void => {
  const ctx = useKeyboardShortcutContext();
  const handlerRef = useRef(handler);

  // Keep the handler ref up to date so we always call the latest version
  handlerRef.current = handler;

  useEffect(() => {
    const unregister = ctx.register({
      combo,
      handler: (e: KeyboardEvent) => {
        handlerRef.current(e);
      },
      description: options.description,
      category: options.category,
      enabled: options.enabled,
      preventDefault: options.preventDefault,
    });

    return unregister;
  }, [
    ctx,
    combo.key,
    combo.ctrlKey,
    combo.metaKey,
    combo.altKey,
    combo.shiftKey,
    options.description,
    options.category,
    options.enabled,
    options.preventDefault,
  ]);
};

export { formatShortcutCombo };
export default useKeyboardShortcut;
