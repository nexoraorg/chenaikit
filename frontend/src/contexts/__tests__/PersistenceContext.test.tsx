import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { PersistenceProvider, usePersistenceContext } from '../PersistenceContext';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistenceProvider>{children}</PersistenceProvider>
);

describe('contexts/PersistenceContext', () => {
  // ─── usePersistenceContext outside provider ────────────────────────────────

  describe('usePersistenceContext', () => {
    it('throws when used outside PersistenceProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => usePersistenceContext())).toThrow(
        'usePersistenceContext must be used within a PersistenceProvider'
      );
      spy.mockRestore();
    });
  });

  // ─── initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty preferences', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      expect(result.current.preferences).toEqual({});
    });

    it('exposes all required functions', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      expect(typeof result.current.updatePreferences).toBe('function');
      expect(typeof result.current.clearAllData).toBe('function');
      expect(typeof result.current.addRecentSearch).toBe('function');
      expect(typeof result.current.clearRecentSearches).toBe('function');
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('merges partial update', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'jp' }); });
      expect(result.current.preferences.language).toBe('jp');
    });

    it('keeps unrelated keys intact', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.updatePreferences({ dashboardLayout: 'list' }); });
      expect(result.current.preferences.language).toBe('en');
      expect(result.current.preferences.dashboardLayout).toBe('list');
    });

    it('writes to localStorage', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'fr' }); });
      const raw = window.localStorage.getItem('chenaikit_preferences');
      expect(JSON.parse(raw!).language).toBe('fr');
    });
  });

  // ─── addRecentSearch ──────────────────────────────────────────────────────

  describe('addRecentSearch', () => {
    it('adds a term to the front of recentSearches', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.addRecentSearch('stellar'); });
      expect(result.current.preferences.recentSearches?.[0]).toBe('stellar');
    });

    it('deduplicates — moves existing term to front', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => {
        result.current.addRecentSearch('a');
        result.current.addRecentSearch('b');
        result.current.addRecentSearch('a'); // duplicate
      });
      const searches = result.current.preferences.recentSearches ?? [];
      expect(searches[0]).toBe('a');
      expect(searches.filter((s) => s === 'a')).toHaveLength(1);
    });

    it('limits to 10 entries', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => {
        for (let i = 0; i < 12; i++) result.current.addRecentSearch(`term-${i}`);
      });
      expect((result.current.preferences.recentSearches ?? []).length).toBeLessThanOrEqual(10);
    });
  });

  // ─── clearRecentSearches ──────────────────────────────────────────────────

  describe('clearRecentSearches', () => {
    it('sets recentSearches to an empty array', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => {
        result.current.addRecentSearch('x');
        result.current.addRecentSearch('y');
      });
      act(() => { result.current.clearRecentSearches(); });
      expect(result.current.preferences.recentSearches).toEqual([]);
    });

    it('does not remove other preference keys', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'es' }); });
      act(() => { result.current.addRecentSearch('q'); });
      act(() => { result.current.clearRecentSearches(); });
      expect(result.current.preferences.language).toBe('es');
    });
  });

  // ─── clearAllData ─────────────────────────────────────────────────────────

  describe('clearAllData', () => {
    it('resets preferences to empty object', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'de', dashboardLayout: 'grid' }); });
      act(() => { result.current.clearAllData(); });
      expect(result.current.preferences).toEqual({});
    });

    it('clears preferences from localStorage', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      act(() => { result.current.updatePreferences({ language: 'en' }); });
      act(() => { result.current.clearAllData(); });
      // localStorage.clear is called — the mock clears its internal store
      expect(window.localStorage.getItem('chenaikit_preferences')).toBeNull();
    });
  });

  // ─── renders children ─────────────────────────────────────────────────────

  describe('renders children', () => {
    it('renders wrapped children without crashing', () => {
      const { result } = renderHook(() => usePersistenceContext(), { wrapper });
      expect(result.current).toBeTruthy();
    });
  });
});
