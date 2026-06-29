// ─── Storage utility ─────────────────────────────────────────────────────────
// Thin wrappers around localStorage and sessionStorage with safe fallbacks.

export type StorageType = 'local' | 'session';

const getStorage = (type: StorageType): Storage | null => {
  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const storageGet = <T>(key: string, type: StorageType = 'local'): T | null => {
  try {
    const storage = getStorage(type);
    if (!storage) return null;
    const item = storage.getItem(key);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
};

export const storageSet = <T>(key: string, value: T, type: StorageType = 'local'): boolean => {
  try {
    const storage = getStorage(type);
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const storageRemove = (key: string, type: StorageType = 'local'): boolean => {
  try {
    const storage = getStorage(type);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const storageClear = (type: StorageType = 'local'): boolean => {
  try {
    const storage = getStorage(type);
    if (!storage) return false;
    storage.clear();
    return true;
  } catch {
    return false;
  }
};