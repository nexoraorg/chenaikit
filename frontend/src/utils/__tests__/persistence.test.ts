import {
  loadPreferences,
  savePreferences,
  updatePreferences,
  clearPreferences,
  addRecentSearch,
  clearRecentSearches,
} from '../persistence';

// localStorage is mocked in setupTests.ts and cleared before each test.

describe('utils/persistence', () => {
  // ─── loadPreferences ───────────────────────────────────────────────────────

  describe('loadPreferences', () => {
    it('returns an empty object when nothing is stored', () => {
      expect(loadPreferences()).toEqual({});
    });

    it('returns stored preferences correctly', () => {
      const prefs = { language: 'fr', dashboardLayout: 'grid' };
      savePreferences(prefs);
      expect(loadPreferences()).toMatchObject(prefs);
    });

    it('returns empty object when stored value is not an object', () => {
      window.localStorage.setItem('chenaikit_preferences', JSON.stringify([1, 2, 3]));
      expect(loadPreferences()).toEqual({});
    });

    it('returns empty object when stored value is malformed JSON', () => {
      window.localStorage.setItem('chenaikit_preferences', '{bad json');
      expect(loadPreferences()).toEqual({});
    });

    it('ignores non-string language values', () => {
      window.localStorage.setItem(
        'chenaikit_preferences',
        JSON.stringify({ language: 42 })
      );
      expect(loadPreferences().language).toBeUndefined();
    });

    it('filters non-string values from recentSearches', () => {
      window.localStorage.setItem(
        'chenaikit_preferences',
        JSON.stringify({ recentSearches: ['valid', 123, null, 'also-valid'] })
      );
      expect(loadPreferences().recentSearches).toEqual(['valid', 'also-valid']);
    });

    it('defaults recentSearches to empty array when missing', () => {
      savePreferences({ language: 'en' });
      expect(loadPreferences().recentSearches).toEqual([]);
    });
  });

  // ─── savePreferences ───────────────────────────────────────────────────────

  describe('savePreferences', () => {
    it('returns true on success', () => {
      expect(savePreferences({})).toBe(true);
    });

    it('persists preferences to localStorage', () => {
      savePreferences({ language: 'de', dashboardLayout: 'list' });
      const loaded = loadPreferences();
      expect(loaded.language).toBe('de');
      expect(loaded.dashboardLayout).toBe('list');
    });

    it('overwrites existing preferences', () => {
      savePreferences({ language: 'en' });
      savePreferences({ language: 'es' });
      expect(loadPreferences().language).toBe('es');
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('returns true on success', () => {
      expect(updatePreferences({ language: 'en' })).toBe(true);
    });

    it('merges partial update into existing preferences', () => {
      savePreferences({ language: 'en', dashboardLayout: 'grid' });
      updatePreferences({ dashboardLayout: 'list' });
      const loaded = loadPreferences();
      expect(loaded.language).toBe('en');
      expect(loaded.dashboardLayout).toBe('list');
    });

    it('adds new keys without removing existing ones', () => {
      savePreferences({ language: 'en' });
      updatePreferences({ dashboardLayout: 'grid' });
      expect(loadPreferences().language).toBe('en');
      expect(loadPreferences().dashboardLayout).toBe('grid');
    });
  });

  // ─── clearPreferences ─────────────────────────────────────────────────────

  describe('clearPreferences', () => {
    it('returns true on success', () => {
      expect(clearPreferences()).toBe(true);
    });

    it('removes the preferences key from storage', () => {
      savePreferences({ language: 'en' });
      clearPreferences();
      expect(loadPreferences()).toEqual({});
    });
  });

  // ─── addRecentSearch ──────────────────────────────────────────────────────

  describe('addRecentSearch', () => {
    it('returns true on success', () => {
      expect(addRecentSearch('bitcoin')).toBe(true);
    });

    it('prepends a new search term', () => {
      addRecentSearch('alpha');
      addRecentSearch('beta');
      expect(loadPreferences().recentSearches?.[0]).toBe('beta');
    });

    it('deduplicates existing terms by moving them to the front', () => {
      addRecentSearch('alpha');
      addRecentSearch('beta');
      addRecentSearch('alpha'); // duplicate — should move to front
      const searches = loadPreferences().recentSearches ?? [];
      expect(searches[0]).toBe('alpha');
      expect(searches.filter((s) => s === 'alpha')).toHaveLength(1);
    });

    it('caps the list at 10 entries', () => {
      for (let i = 0; i < 12; i++) addRecentSearch(`term-${i}`);
      const searches = loadPreferences().recentSearches ?? [];
      expect(searches.length).toBeLessThanOrEqual(10);
    });
  });

  // ─── clearRecentSearches ──────────────────────────────────────────────────

  describe('clearRecentSearches', () => {
    it('returns true on success', () => {
      expect(clearRecentSearches()).toBe(true);
    });

    it('empties the recent searches list', () => {
      addRecentSearch('alpha');
      addRecentSearch('beta');
      clearRecentSearches();
      expect(loadPreferences().recentSearches).toEqual([]);
    });

    it('preserves other preferences when clearing searches', () => {
      savePreferences({ language: 'en' });
      addRecentSearch('something');
      clearRecentSearches();
      expect(loadPreferences().language).toBe('en');
    });
  });
});
