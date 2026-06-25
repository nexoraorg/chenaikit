import {
  DEFAULT_SHORTCUTS,
  expandsToReservedShortcut,
  findShortcutConflict,
  getShortcutDisplayLabel,
  normalizeShortcutKeys,
} from '../index';

describe('keyboard shortcut registry', () => {
  it('normalizes modifier order and aliases', () => {
    expect(normalizeShortcutKeys('Shift+Command+L')).toBe('meta+shift+l');
    expect(normalizeShortcutKeys('h>g')).toBe('h>g');
  });

  it('formats labels for display', () => {
    expect(getShortcutDisplayLabel({ keys: 'mod+shift+l' })).toBe('Ctrl/Command+Shift+L');
    expect(getShortcutDisplayLabel({ keys: 'g>h', label: 'G then H' })).toBe('G then H');
  });

  it('detects browser-reserved shortcuts', () => {
    expect(expandsToReservedShortcut('ctrl+d')).toBe(true);
    expect(expandsToReservedShortcut('mod+shift+l')).toBe(false);
  });

  it('detects app shortcut conflicts', () => {
    const conflict = findShortcutConflict(
      'navigation.profile',
      'g>h',
      DEFAULT_SHORTCUTS,
      {}
    );

    expect(conflict).toEqual({
      shortcutId: 'navigation.profile',
      conflictingId: 'navigation.dashboard',
      keys: 'g>h',
    });
  });
});
