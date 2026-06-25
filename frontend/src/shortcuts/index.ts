export type ShortcutCategory = 'navigation' | 'action' | 'search' | 'settings' | 'help';

export type ShortcutScope = 'global' | 'dashboard' | 'settings';

export type ShortcutId =
  | 'help.open'
  | 'navigation.dashboard'
  | 'navigation.profile'
  | 'navigation.settings'
  | 'dashboard.analytics'
  | 'dashboard.forms'
  | 'dashboard.visualization'
  | 'search.focus'
  | 'settings.shortcuts'
  | 'action.theme.toggle'
  | 'action.signout';

export interface ShortcutBinding {
  keys: string;
  label?: string;
}

export interface ShortcutDefinition {
  id: ShortcutId;
  category: ShortcutCategory;
  scope: ShortcutScope;
  title: string;
  description: string;
  defaultBinding: ShortcutBinding;
  preventDefault?: boolean;
  allowInFormFields?: boolean;
}

export interface ShortcutConflict {
  shortcutId: ShortcutId;
  conflictingId: ShortcutId;
  keys: string;
}

export const SHORTCUT_STORAGE_KEY = 'chenaikit_shortcuts';

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  action: 'Actions',
  search: 'Search',
  settings: 'Settings',
  help: 'Help',
};

export const SHORTCUT_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
  id: id as ShortcutCategory,
  label,
}));

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'help.open',
    category: 'help',
    scope: 'global',
    title: 'Open shortcut help',
    description: 'Show the keyboard shortcut cheat sheet and customization controls.',
    defaultBinding: { keys: 'shift+/', label: '?' },
    preventDefault: true,
  },
  {
    id: 'navigation.dashboard',
    category: 'navigation',
    scope: 'global',
    title: 'Go to dashboard',
    description: 'Navigate to the main dashboard.',
    defaultBinding: { keys: 'g>h', label: 'G then H' },
    preventDefault: true,
  },
  {
    id: 'navigation.profile',
    category: 'navigation',
    scope: 'global',
    title: 'Go to profile',
    description: 'Navigate to the profile page.',
    defaultBinding: { keys: 'g>p', label: 'G then P' },
    preventDefault: true,
  },
  {
    id: 'navigation.settings',
    category: 'navigation',
    scope: 'global',
    title: 'Go to settings',
    description: 'Navigate to the settings page.',
    defaultBinding: { keys: 'g>s', label: 'G then S' },
    preventDefault: true,
  },
  {
    id: 'dashboard.analytics',
    category: 'navigation',
    scope: 'dashboard',
    title: 'Show analytics dashboard',
    description: 'Switch the dashboard to analytics.',
    defaultBinding: { keys: 'alt+1', label: 'Alt+1' },
    preventDefault: true,
  },
  {
    id: 'dashboard.forms',
    category: 'navigation',
    scope: 'dashboard',
    title: 'Show forms',
    description: 'Switch the dashboard to forms.',
    defaultBinding: { keys: 'alt+2', label: 'Alt+2' },
    preventDefault: true,
  },
  {
    id: 'dashboard.visualization',
    category: 'navigation',
    scope: 'dashboard',
    title: 'Show visualization sandbox',
    description: 'Switch the dashboard to the visualization sandbox.',
    defaultBinding: { keys: 'alt+3', label: 'Alt+3' },
    preventDefault: true,
  },
  {
    id: 'search.focus',
    category: 'search',
    scope: 'global',
    title: 'Focus search',
    description: 'Move focus to the first search field on the current page.',
    defaultBinding: { keys: '/', label: '/' },
    preventDefault: true,
  },
  {
    id: 'settings.shortcuts',
    category: 'settings',
    scope: 'global',
    title: 'Customize shortcuts',
    description: 'Open the shortcut settings view.',
    defaultBinding: { keys: 'mod+shift+,', label: 'Ctrl/Command+Shift+,' },
    preventDefault: true,
  },
  {
    id: 'action.theme.toggle',
    category: 'action',
    scope: 'global',
    title: 'Toggle theme',
    description: 'Switch between light and dark mode.',
    defaultBinding: { keys: 'mod+shift+l', label: 'Ctrl/Command+Shift+L' },
    preventDefault: true,
  },
  {
    id: 'action.signout',
    category: 'action',
    scope: 'global',
    title: 'Sign out',
    description: 'Sign out of the current session.',
    defaultBinding: { keys: 'mod+shift+q', label: 'Ctrl/Command+Shift+Q' },
    preventDefault: true,
  },
];

const BROWSER_RESERVED_SHORTCUTS = new Set([
  'ctrl+d',
  'meta+d',
  'ctrl+l',
  'meta+l',
  'ctrl+n',
  'meta+n',
  'ctrl+p',
  'meta+p',
  'ctrl+r',
  'meta+r',
  'ctrl+s',
  'meta+s',
  'ctrl+t',
  'meta+t',
  'ctrl+w',
  'meta+w',
  'alt+left',
  'alt+right',
  'ctrl+tab',
  'ctrl+shift+tab',
  'meta+tab',
  'meta+shift+tab',
]);

const KEY_ALIASES: Record<string, string> = {
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
  escape: 'esc',
  return: 'enter',
  plus: '+',
};

const MODIFIER_ORDER = ['ctrl', 'meta', 'mod', 'alt', 'shift'];

export const getShortcutCategoryLabel = (category: ShortcutCategory): string =>
  CATEGORY_LABELS[category];

export const normalizeShortcutKeys = (keys: string): string => {
  return keys
    .split('>')
    .map((step) => {
      const parts = step
        .split('+')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .map((part) => KEY_ALIASES[part] ?? part);

      const modifiers = MODIFIER_ORDER.filter((modifier) => parts.includes(modifier));
      const regularKeys = parts.filter((part) => !MODIFIER_ORDER.includes(part)).sort();
      return [...modifiers, ...regularKeys].join('+');
    })
    .join('>');
};

export const getShortcutDisplayLabel = (binding: ShortcutBinding): string => {
  if (binding.label) return binding.label;

  return binding.keys
    .split('>')
    .map((step) =>
      step
        .split('+')
        .map((part) => {
          const normalized = part.trim().toLowerCase();
          if (normalized === 'mod') return 'Ctrl/Command';
          if (normalized === 'ctrl') return 'Ctrl';
          if (normalized === 'meta') return 'Command';
          if (normalized === 'alt') return 'Alt';
          if (normalized === 'shift') return 'Shift';
          if (normalized === 'esc') return 'Esc';
          return normalized.length === 1 ? normalized.toUpperCase() : normalized;
        })
        .join('+')
    )
    .join(' then ');
};

export const expandsToReservedShortcut = (keys: string): boolean => {
  const normalized = normalizeShortcutKeys(keys);
  const candidates = normalized.includes('mod')
    ? [normalized.replace('mod', 'ctrl'), normalized.replace('mod', 'meta')]
    : [normalized];

  return candidates.some((candidate) => BROWSER_RESERVED_SHORTCUTS.has(candidate));
};

export const findShortcutConflict = (
  shortcutId: ShortcutId,
  keys: string,
  shortcuts: ShortcutDefinition[],
  customBindings: Partial<Record<ShortcutId, ShortcutBinding>>
): ShortcutConflict | null => {
  const normalized = normalizeShortcutKeys(keys);

  for (const shortcut of shortcuts) {
    if (shortcut.id === shortcutId) continue;

    const candidate = customBindings[shortcut.id] ?? shortcut.defaultBinding;
    if (normalizeShortcutKeys(candidate.keys) === normalized) {
      return {
        shortcutId,
        conflictingId: shortcut.id,
        keys,
      };
    }
  }

  return null;
};

export const getDefaultShortcut = (id: ShortcutId): ShortcutDefinition | undefined =>
  DEFAULT_SHORTCUTS.find((shortcut) => shortcut.id === id);
