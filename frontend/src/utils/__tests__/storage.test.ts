import { storageGet, storageSet, storageRemove, storageClear } from '../storage';

// The localStorage/sessionStorage mocks are set up in setupTests.ts and cleared
// between each test automatically.

describe('utils/storage', () => {
  // ─── storageGet ────────────────────────────────────────────────────────────

  describe('storageGet', () => {
    it('returns null when key does not exist', () => {
      expect(storageGet('missing')).toBeNull();
    });

    it('returns null for session storage when key does not exist', () => {
      expect(storageGet('missing', 'session')).toBeNull();
    });

    it('returns a parsed value that was previously set', () => {
      storageSet('name', 'alice');
      expect(storageGet<string>('name')).toBe('alice');
    });

    it('parses a stored JSON object', () => {
      storageSet('obj', { x: 1, y: 2 });
      expect(storageGet<{ x: number; y: number }>('obj')).toEqual({ x: 1, y: 2 });
    });

    it('parses a stored array', () => {
      storageSet('arr', [1, 2, 3]);
      expect(storageGet<number[]>('arr')).toEqual([1, 2, 3]);
    });

    it('parses a stored boolean', () => {
      storageSet('flag', false);
      expect(storageGet<boolean>('flag')).toBe(false);
    });

    it('reads from session storage when type is "session"', () => {
      storageSet('sessKey', 'sessVal', 'session');
      expect(storageGet<string>('sessKey', 'session')).toBe('sessVal');
    });

    it('does not leak between local and session storage', () => {
      storageSet('shared', 'local-value', 'local');
      expect(storageGet('shared', 'session')).toBeNull();
    });

    it('returns null when stored value is malformed JSON', () => {
      // Directly corrupt the underlying mock to simulate a bad value
      window.localStorage.setItem('bad', '{not valid json');
      expect(storageGet('bad')).toBeNull();
    });
  });

  // ─── storageSet ────────────────────────────────────────────────────────────

  describe('storageSet', () => {
    it('returns true on success', () => {
      expect(storageSet('k', 'v')).toBe(true);
    });

    it('stores a string value', () => {
      storageSet('greeting', 'hello');
      expect(window.localStorage.getItem('greeting')).toBe(JSON.stringify('hello'));
    });

    it('stores a number value', () => {
      storageSet('count', 42);
      expect(window.localStorage.getItem('count')).toBe('42');
    });

    it('stores an object value as JSON', () => {
      storageSet('config', { debug: true });
      expect(window.localStorage.getItem('config')).toBe(JSON.stringify({ debug: true }));
    });

    it('overwrites an existing key', () => {
      storageSet('key', 'first');
      storageSet('key', 'second');
      expect(storageGet<string>('key')).toBe('second');
    });

    it('writes to session storage when type is "session"', () => {
      storageSet('sKey', 'sVal', 'session');
      expect(window.sessionStorage.getItem('sKey')).toBe(JSON.stringify('sVal'));
    });
  });

  // ─── storageRemove ─────────────────────────────────────────────────────────

  describe('storageRemove', () => {
    it('returns true on success', () => {
      storageSet('toRemove', 'val');
      expect(storageRemove('toRemove')).toBe(true);
    });

    it('removes an existing key', () => {
      storageSet('doomed', 'data');
      storageRemove('doomed');
      expect(storageGet('doomed')).toBeNull();
    });

    it('returns true even when key does not exist', () => {
      expect(storageRemove('nonExistent')).toBe(true);
    });

    it('removes only the specified key', () => {
      storageSet('keep', 'safe');
      storageSet('remove', 'gone');
      storageRemove('remove');
      expect(storageGet<string>('keep')).toBe('safe');
      expect(storageGet('remove')).toBeNull();
    });

    it('removes from session storage when type is "session"', () => {
      storageSet('sRemove', 'val', 'session');
      storageRemove('sRemove', 'session');
      expect(storageGet('sRemove', 'session')).toBeNull();
    });
  });

  // ─── storageClear ──────────────────────────────────────────────────────────

  describe('storageClear', () => {
    it('returns true on success', () => {
      expect(storageClear()).toBe(true);
    });

    it('clears all local storage entries', () => {
      storageSet('a', 1);
      storageSet('b', 2);
      storageClear();
      expect(storageGet('a')).toBeNull();
      expect(storageGet('b')).toBeNull();
    });

    it('does not affect session storage when clearing local', () => {
      storageSet('sess', 'intact', 'session');
      storageClear('local');
      expect(storageGet<string>('sess', 'session')).toBe('intact');
    });

    it('clears session storage when type is "session"', () => {
      storageSet('s1', 'v1', 'session');
      storageClear('session');
      expect(storageGet('s1', 'session')).toBeNull();
    });
  });
});
