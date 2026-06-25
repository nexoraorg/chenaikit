import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useThemeMode } from '../ThemeContext';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('contexts/ThemeContext', () => {
  // ─── useThemeMode outside provider ────────────────────────────────────────

  describe('useThemeMode', () => {
    it('throws when used outside ThemeProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useThemeMode())).toThrow(
        'useThemeMode must be used within a ThemeProvider'
      );
      spy.mockRestore();
    });
  });

  // ─── initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('exposes mode, userPreference, setTheme, toggleTheme', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      expect(['light', 'dark']).toContain(result.current.mode);
      expect(['light', 'dark', 'system']).toContain(result.current.userPreference);
      expect(typeof result.current.setTheme).toBe('function');
      expect(typeof result.current.toggleTheme).toBe('function');
    });

    it('defaults to "system" preference when localStorage is empty', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      expect(result.current.userPreference).toBe('system');
    });

    it('resolves system preference to a concrete light/dark mode', () => {
      // matchMedia is mocked to return matches:false → system is "light"
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      expect(result.current.mode).toBe('light');
    });
  });

  // ─── setTheme() ───────────────────────────────────────────────────────────

  describe('setTheme()', () => {
    it('sets userPreference to "dark"', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('dark'); });
      expect(result.current.userPreference).toBe('dark');
      expect(result.current.mode).toBe('dark');
    });

    it('sets userPreference to "light"', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('light'); });
      expect(result.current.userPreference).toBe('light');
      expect(result.current.mode).toBe('light');
    });

    it('sets userPreference to "system"', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('dark'); }); // change first
      act(() => { result.current.setTheme('system'); });
      expect(result.current.userPreference).toBe('system');
    });

    it('persists the preference to localStorage', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('dark'); });
      expect(window.localStorage.getItem('chenaikit_theme')).toBe('dark');
    });
  });

  // ─── toggleTheme() ────────────────────────────────────────────────────────

  describe('toggleTheme()', () => {
    it('switches from light to dark', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('light'); });
      act(() => { result.current.toggleTheme(); });
      expect(result.current.mode).toBe('dark');
    });

    it('switches from dark to light', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('dark'); });
      act(() => { result.current.toggleTheme(); });
      expect(result.current.mode).toBe('light');
    });

    it('persists the toggled preference to localStorage', () => {
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      act(() => { result.current.setTheme('light'); });
      act(() => { result.current.toggleTheme(); });
      expect(window.localStorage.getItem('chenaikit_theme')).toBe('dark');
    });
  });

  // ─── reads stored preference on mount ────────────────────────────────────

  describe('reads stored preference on mount', () => {
    it('restores "dark" from localStorage', () => {
      window.localStorage.setItem('chenaikit_theme', 'dark');
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      expect(result.current.userPreference).toBe('dark');
      expect(result.current.mode).toBe('dark');
    });

    it('restores "light" from localStorage', () => {
      window.localStorage.setItem('chenaikit_theme', 'light');
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      expect(result.current.userPreference).toBe('light');
      expect(result.current.mode).toBe('light');
    });

    it('ignores invalid values in localStorage', () => {
      window.localStorage.setItem('chenaikit_theme', 'invalid-value');
      const { result } = renderHook(() => useThemeMode(), { wrapper });
      // Falls back to system preference
      expect(result.current.userPreference).toBe('system');
    });
  });
});
