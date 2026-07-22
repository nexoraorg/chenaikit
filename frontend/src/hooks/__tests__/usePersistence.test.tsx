import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { PersistenceProvider } from '../../contexts/PersistenceContext';
import usePersistence from '../usePersistence';

// Wrap every renderHook call in PersistenceProvider
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistenceProvider>{children}</PersistenceProvider>
);

describe('hooks/usePersistence', () => {
  // ─── API surface ──────────────────────────────────────────────────────────

  describe('API surface', () => {
    it('exposes preferences, updatePreferences, clearAllData, addRecentSearch, clearRecentSearches', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      expect(typeof result.current.preferences).toBe('object');
      expect(typeof result.current.updatePreferences).toBe('function');
      expect(typeof result.current.clearAllData).toBe('function');
      expect(typeof result.current.addRecentSearch).toBe('function');
      expect(typeof result.current.clearRecentSearches).toBe('function');
    });
  });

  // ─── initial preferences ──────────────────────────────────────────────────

  describe('initial preferences', () => {
    it('starts with an empty preferences object when storage is empty', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      expect(result.current.preferences).toEqual({});
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('merges a partial update into preferences', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'fr' }); });
      expect(result.current.preferences.language).toBe('fr');
    });

    it('preserves existing keys when updating another key', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.updatePreferences({ dashboardLayout: 'grid' }); });
      expect(result.current.preferences.language).toBe('en');
      expect(result.current.preferences.dashboardLayout).toBe('grid');
    });

    it('persists changes to localStorage', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'de' }); });
      const raw = window.localStorage.getItem('chenaikit_preferences');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.language).toBe('de');
    });

    it('overwrites a key when the same key is updated twice', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.updatePreferences({ language: 'jp' }); });
      expect(result.current.preferences.language).toBe('jp');
    });
  });

  // ─── addRecentSearch ──────────────────────────────────────────────────────

  describe('addRecentSearch', () => {
    it('prepends a search term to recentSearches', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.addRecentSearch('bitcoin'); });
      expect(result.current.preferences.recentSearches?.[0]).toBe('bitcoin');
    });

    it('deduplicates by moving an existing term to the front', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => {
        result.current.addRecentSearch('alpha');
        result.current.addRecentSearch('beta');
        result.current.addRecentSearch('alpha'); // duplicate
      });
      const searches = result.current.preferences.recentSearches ?? [];
      expect(searches[0]).toBe('alpha');
      expect(searches.filter((s) => s === 'alpha')).toHaveLength(1);
    });

    it('caps the list at 10 entries', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => {
        for (let i = 0; i < 15; i++) result.current.addRecentSearch(`term-${i}`);
      });
      expect((result.current.preferences.recentSearches ?? []).length).toBeLessThanOrEqual(10);
    });
  });

  // ─── clearRecentSearches ──────────────────────────────────────────────────

  describe('clearRecentSearches', () => {
    it('empties the recentSearches list', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => {
        result.current.addRecentSearch('alpha');
        result.current.addRecentSearch('beta');
      });
      act(() => { result.current.clearRecentSearches(); });
      expect(result.current.preferences.recentSearches).toEqual([]);
    });

    it('preserves other preference keys after clearing searches', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.addRecentSearch('something'); });
      act(() => { result.current.clearRecentSearches(); });
      expect(result.current.preferences.language).toBe('en');
    });
  });

  // ─── clearAllData ─────────────────────────────────────────────────────────

  describe('clearAllData', () => {
    it('resets preferences to an empty object', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'fr', dashboardLayout: 'list' }); });
      act(() => { result.current.clearAllData(); });
      expect(result.current.preferences).toEqual({});
    });

    it('removes preferences from localStorage', () => {
      const { result } = renderHook(() => usePersistence(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.clearAllData(); });
      // localStorage.clear should have been called (from storageClear)
      expect(window.localStorage.getItem('chenaikit_preferences')).toBeNull();
    });
  });

  // ─── throws when used outside provider ────────────────────────────────────

  describe('error boundary', () => {
    it('throws when used outside PersistenceProvider', () => {
      // Suppress console.error for this intentional error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => usePersistence())).toThrow(
        'usePersistenceContext must be used within a PersistenceProvider'
      );
      spy.mockRestore();
    });
  });
});
