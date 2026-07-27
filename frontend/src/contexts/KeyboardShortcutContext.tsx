import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Key combination for a shortcut */
export interface ShortcutCombo {
  /** Required modifier keys */
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  /** The main key (e.g., 'k', 'Escape', '?') */
  key: string;
}

/** A registered keyboard shortcut */
export interface Shortcut {
  id: string;
  /** Key combination that triggers this shortcut */
  combo: ShortcutCombo;
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
  /** Human-readable description for the help dialog */
  description: string;
  /** Category for grouping in help dialog */
  category?: string;
  /** Whether this shortcut is enabled. Defaults to true. */
  enabled?: boolean;
  /** Whether to prevent default browser behavior. Defaults to true. */
  preventDefault?: boolean;
}

export interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    combo: ShortcutCombo;
    description: string;
  }>;
}

export interface KeyboardShortcutContextValue {
  /** Register a keyboard shortcut */
  register: (shortcut: Omit<Shortcut, 'id'>) => () => void;
  /** Unregister a shortcut by ID */
  unregister: (id: string) => void;
  /** Get all registered shortcuts (for help dialog) */
  getShortcuts: () => Shortcut[];
  /** Get shortcuts grouped by category */
  getGroups: () => ShortcutGroup[];
  /** Whether shortcuts are globally enabled */
  enabled: boolean;
  /** Toggle all shortcuts on/off */
  setEnabled: (enabled: boolean) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | undefined>(undefined);

// ─── ID generator ────────────────────────────────────────────────────────────

let _shortcutIdCounter = 0;
const generateShortcutId = (): string => `shortcut-${Date.now()}-${++_shortcutIdCounter}`;

// ─── Key matching helper ─────────────────────────────────────────────────────

function matchesCombo(e: KeyboardEvent, combo: ShortcutCombo): boolean {
  const key = e.key.toLowerCase();
  const comboKey = combo.key.toLowerCase();

  // Handle special key names
  const normalizedKey = key === 'escape' ? 'escape' : key;
  const normalizedComboKey = comboKey === 'escape' ? 'escape' : comboKey;

  const keyMatch = normalizedKey === normalizedComboKey ||
    // Also match code name for special keys
    e.code.toLowerCase() === normalizedComboKey;

  if (!keyMatch) return false;

  // Check modifier keys
  const ctrlMatch = combo.ctrlKey ?? false;
  const metaMatch = combo.metaKey ?? false;
  const altMatch = combo.altKey ?? false;
  const shiftMatch = combo.shiftKey ?? false;

  // On macOS, Meta (Cmd) is often used where Ctrl is on other platforms.
  // We treat Ctrl and Meta as interchangeable for Cmd/Ctrl combos.
  const hasRequiredModifiers =
    (e.ctrlKey === ctrlMatch || e.metaKey === ctrlMatch) &&
    (e.metaKey === metaMatch || e.ctrlKey === metaMatch) &&
    e.altKey === altMatch &&
    e.shiftKey === shiftMatch;

  return hasRequiredModifiers;
}

// ─── Format combo for display ────────────────────────────────────────────────

export function formatShortcutCombo(combo: ShortcutCombo): string {
  const parts: string[] = [];
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac');

  if (combo.ctrlKey) {
    parts.push(isMac ? '⌃' : 'Ctrl');
  }
  if (combo.metaKey) {
    parts.push(isMac ? '⌘' : 'Meta');
  }
  if (combo.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (combo.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  const keyMap: Record<string, string> = {
    'escape': 'Esc',
    'enter': 'Enter',
    ' ': 'Space',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'delete': 'Del',
    'backspace': 'Bksp',
    'tab': 'Tab',
  };

  const displayKey = keyMap[combo.key.toLowerCase()] ?? combo.key.toUpperCase();
  parts.push(displayKey);

  return parts.join(' + ');
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface KeyboardShortcutProviderProps {
  children: React.ReactNode;
  /** Enable shortcuts by default */
  enabled?: boolean;
}

export const KeyboardShortcutProvider: React.FC<KeyboardShortcutProviderProps> = ({
  children,
  enabled: defaultEnabled = true,
}) => {
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());
  const [enabled, setEnabled] = useState(defaultEnabled);

  // Create memoized getter functions to avoid stale closures
  const getShortcuts = useCallback((): Shortcut[] => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  const getGroups = useCallback((): ShortcutGroup[] => {
    const groups = new Map<string, Array<{ combo: ShortcutCombo; description: string }>>();
    const shortcuts = getShortcuts();

    for (const s of shortcuts) {
      if (!s.description) continue;
      const category = s.category ?? 'General';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push({ combo: s.combo, description: s.description });
    }

    return Array.from(groups.entries()).map(([category, shortcuts]) => ({
      category,
      shortcuts,
    }));
  }, [getShortcuts]);

  const register = useCallback((shortcut: Omit<Shortcut, 'id'>): (() => void) => {
    const id = generateShortcutId();
    shortcutsRef.current.set(id, { ...shortcut, id });
    return () => {
      shortcutsRef.current.delete(id);
    };
  }, []);

  const unregister = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
  }, []);

  // Set up global keydown listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      const isModifierOnly = ['Control', 'Meta', 'Alt', 'Shift'].includes(e.key);

      if (isInput || isModifierOnly) return;

      const shortcuts = getShortcuts();

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (matchesCombo(e, shortcut.combo)) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          shortcut.handler(e);
          return; // Only trigger the first matching shortcut
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, getShortcuts]);

  const value = useMemo<KeyboardShortcutContextValue>(
    () => ({
      register,
      unregister,
      getShortcuts,
      getGroups,
      enabled,
      setEnabled,
    }),
    [register, unregister, getShortcuts, getGroups, enabled]
  );

  return (
    <KeyboardShortcutContext.Provider value={value}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useKeyboardShortcutContext = (): KeyboardShortcutContextValue => {
  const ctx = useContext(KeyboardShortcutContext);
  if (!ctx) {
    throw new Error(
      'useKeyboardShortcutContext must be used within a KeyboardShortcutProvider'
    );
  }
  return ctx;
};

export default KeyboardShortcutContext;
