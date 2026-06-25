import { useCallback, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ShortcutDefinition, getShortcutDisplayLabel } from '../shortcuts';
import { useShortcutContext } from '../contexts/ShortcutContext';

interface UseKeyboardShortcutOptions {
  enabled?: boolean;
  allowInFormFields?: boolean;
}

const INTERACTIVE_ROLES = new Set([
  'combobox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'textbox',
]);

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (target.isContentEditable) return true;

  const role = target.getAttribute('role');
  return role ? INTERACTIVE_ROLES.has(role) : false;
};

export const useKeyboardShortcut = (
  shortcut: ShortcutDefinition,
  handler: (event: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
): void => {
  const {
    getShortcutBinding,
    registerShortcut,
    reportShortcutPressed,
    unregisterShortcut,
  } = useShortcutContext();

  const enabled = options.enabled ?? true;
  const binding = getShortcutBinding(shortcut.id);
  const keys = binding.keys || shortcut.defaultBinding.keys;
  const allowInFormFields = options.allowInFormFields ?? shortcut.allowInFormFields ?? false;

  useEffect(() => {
    registerShortcut(shortcut);
    return () => unregisterShortcut(shortcut.id);
  }, [registerShortcut, shortcut, unregisterShortcut]);

  const callback = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      handler(event);
      reportShortcutPressed(shortcut.id);
    },
    [enabled, handler, reportShortcutPressed, shortcut.id]
  );

  const hotkeyOptions = useMemo(
    () => ({
      enabled,
      enableOnFormTags: allowInFormFields,
      enableOnContentEditable: allowInFormFields,
      preventDefault: shortcut.preventDefault ?? true,
      description: shortcut.description,
      delimiter: '|',
      scopes: shortcut.scope,
      sequenceSplitKey: '>',
      ignoreEventWhen: (event: KeyboardEvent) =>
        !allowInFormFields && isEditableTarget(event.target),
    }),
    [allowInFormFields, enabled, shortcut.description, shortcut.preventDefault, shortcut.scope]
  );

  useHotkeys(keys, callback, hotkeyOptions, [callback, keys, hotkeyOptions]);
};

export const useShortcutLabel = (shortcutId: ShortcutDefinition['id']): string => {
  const { getShortcutBinding } = useShortcutContext();
  const binding = getShortcutBinding(shortcutId);
  return getShortcutDisplayLabel(binding);
};
