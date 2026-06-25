import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_STORAGE_KEY,
  ShortcutBinding,
  ShortcutConflict,
  ShortcutDefinition,
  ShortcutId,
  expandsToReservedShortcut,
  findShortcutConflict,
  getDefaultShortcut,
  normalizeShortcutKeys,
} from '../shortcuts';
import { storageGet, storageSet } from '../utils/storage';

type ShortcutBindings = Partial<Record<ShortcutId, ShortcutBinding>>;

interface ShortcutFeedback {
  id: ShortcutId;
  label: string;
  title: string;
}

interface ShortcutUpdateResult {
  ok: boolean;
  error?: string;
  conflict?: ShortcutConflict;
}

interface ShortcutContextValue {
  shortcuts: ShortcutDefinition[];
  customBindings: ShortcutBindings;
  helpOpen: boolean;
  feedback: ShortcutFeedback | null;
  openHelp: () => void;
  closeHelp: () => void;
  registerShortcut: (shortcut: ShortcutDefinition) => void;
  unregisterShortcut: (id: ShortcutId) => void;
  getShortcutBinding: (id: ShortcutId) => ShortcutBinding;
  setShortcutBinding: (id: ShortcutId, binding: ShortcutBinding) => ShortcutUpdateResult;
  resetShortcutBinding: (id: ShortcutId) => void;
  resetAllShortcutBindings: () => void;
  reportShortcutPressed: (id: ShortcutId) => void;
}

const ShortcutContext = createContext<ShortcutContextValue | undefined>(undefined);

const readStoredBindings = (): ShortcutBindings => {
  const stored = storageGet<unknown>(SHORTCUT_STORAGE_KEY);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};

  const bindings: ShortcutBindings = {};
  Object.entries(stored as Record<string, unknown>).forEach(([id, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const binding = value as Record<string, unknown>;
    if (typeof binding.keys !== 'string') return;
    const knownShortcut = getDefaultShortcut(id as ShortcutId);
    if (!knownShortcut) return;
    bindings[id as ShortcutId] = {
      keys: binding.keys,
      label: typeof binding.label === 'string' ? binding.label : undefined,
    };
  });

  return bindings;
};

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registeredShortcuts, setRegisteredShortcuts] = useState<Record<string, ShortcutDefinition>>({});
  const [customBindings, setCustomBindings] = useState<ShortcutBindings>(readStoredBindings);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState<ShortcutFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    storageSet(SHORTCUT_STORAGE_KEY, customBindings);
  }, [customBindings]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const shortcuts = useMemo(() => {
    const byId = new Map<ShortcutId, ShortcutDefinition>();
    DEFAULT_SHORTCUTS.forEach((shortcut) => byId.set(shortcut.id, shortcut));
    Object.values(registeredShortcuts).forEach((shortcut) => byId.set(shortcut.id, shortcut));
    return Array.from(byId.values());
  }, [registeredShortcuts]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const registerShortcut = useCallback((shortcut: ShortcutDefinition) => {
    setRegisteredShortcuts((current) => {
      const existing = current[shortcut.id];
      if (existing && existing.defaultBinding.keys === shortcut.defaultBinding.keys) return current;
      return { ...current, [shortcut.id]: shortcut };
    });
  }, []);

  const unregisterShortcut = useCallback((id: ShortcutId) => {
    setRegisteredShortcuts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const getShortcutBinding = useCallback(
    (id: ShortcutId): ShortcutBinding => {
      const shortcut = shortcuts.find((candidate) => candidate.id === id) ?? getDefaultShortcut(id);
      if (!shortcut) return { keys: '' };
      return customBindings[id] ?? shortcut.defaultBinding;
    },
    [customBindings, shortcuts]
  );

  const setShortcutBinding = useCallback(
    (id: ShortcutId, binding: ShortcutBinding): ShortcutUpdateResult => {
      const keys = normalizeShortcutKeys(binding.keys);
      if (!keys) return { ok: false, error: 'Enter a shortcut before saving.' };

      if (expandsToReservedShortcut(keys)) {
        return { ok: false, error: 'That shortcut is reserved by the browser or operating system.' };
      }

      const conflict = findShortcutConflict(id, keys, shortcuts, customBindings);
      if (conflict) {
        const conflictingShortcut = shortcuts.find((shortcut) => shortcut.id === conflict.conflictingId);
        return {
          ok: false,
          error: `That shortcut is already used by ${conflictingShortcut?.title ?? conflict.conflictingId}.`,
          conflict,
        };
      }

      setCustomBindings((current) => ({
        ...current,
        [id]: {
          keys,
          label: binding.label,
        },
      }));

      return { ok: true };
    },
    [customBindings, shortcuts]
  );

  const resetShortcutBinding = useCallback((id: ShortcutId) => {
    setCustomBindings((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const resetAllShortcutBindings = useCallback(() => {
    setCustomBindings({});
  }, []);

  const reportShortcutPressed = useCallback(
    (id: ShortcutId) => {
      const shortcut = shortcuts.find((candidate) => candidate.id === id);
      if (!shortcut) return;

      const binding = getShortcutBinding(id);
      setFeedback({ id, label: binding.label ?? binding.keys, title: shortcut.title });

      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 900);
    },
    [getShortcutBinding, shortcuts]
  );

  const value = useMemo<ShortcutContextValue>(
    () => ({
      shortcuts,
      customBindings,
      helpOpen,
      feedback,
      openHelp,
      closeHelp,
      registerShortcut,
      unregisterShortcut,
      getShortcutBinding,
      setShortcutBinding,
      resetShortcutBinding,
      resetAllShortcutBindings,
      reportShortcutPressed,
    }),
    [
      shortcuts,
      customBindings,
      helpOpen,
      feedback,
      openHelp,
      closeHelp,
      registerShortcut,
      unregisterShortcut,
      getShortcutBinding,
      setShortcutBinding,
      resetShortcutBinding,
      resetAllShortcutBindings,
      reportShortcutPressed,
    ]
  );

  return (
    <HotkeysProvider initiallyActiveScopes={['global', 'dashboard', 'settings']}>
      <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>
    </HotkeysProvider>
  );
};

export const useShortcutContext = (): ShortcutContextValue => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcutContext must be used within ShortcutProvider');
  }
  return context;
};
