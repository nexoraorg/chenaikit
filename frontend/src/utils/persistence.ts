// ─── Persistence helpers ──────────────────────────────────────────────────────
// Higher-level helpers built on top of storage.ts.

import { storageGet, storageSet, storageRemove } from './storage';

export interface UserPreferences {
  language?: string;
  dashboardLayout?: string;
  recentSearches?: string[];
  filterStates?: Record<string, unknown>;
  columnLayouts?: Record<string, unknown>;
}

const PREFERENCES_KEY = 'chenaikit_preferences';

export const loadPreferences = (): UserPreferences => {
  return storageGet<UserPreferences>(PREFERENCES_KEY) ?? {};
};

export const savePreferences = (prefs: UserPreferences): boolean => {
  return storageSet(PREFERENCES_KEY, prefs);
};

export const updatePreferences = (partial: Partial<UserPreferences>): boolean => {
  const current = loadPreferences();
  return savePreferences({ ...current, ...partial });
};

export const clearPreferences = (): boolean => {
  return storageRemove(PREFERENCES_KEY);
};

// ─── Recent searches ──────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 10;

export const addRecentSearch = (term: string): boolean => {
  const prefs = loadPreferences();
  const searches = prefs.recentSearches ?? [];
  const filtered = searches.filter((s) => s !== term);
  const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  return updatePreferences({ recentSearches: updated });
};

export const clearRecentSearches = (): boolean => {
  return updatePreferences({ recentSearches: [] });
};