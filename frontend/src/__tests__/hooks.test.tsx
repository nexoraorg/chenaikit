/**
 * Top-level hook integration tests.
 *
 * Unit tests for individual hooks live in their own files under
 * src/hooks/__tests__/. This file covers cross-cutting integration
 * scenarios and ensures the hooks work together inside a full
 * provider tree.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ToastProvider } from '../contexts/ToastContext';
import { PersistenceProvider } from '../contexts/PersistenceContext';
import { LoadingProvider } from '../contexts/LoadingContext';
import useToast from '../hooks/useToast';
import usePersistence from '../hooks/usePersistence';
import { useLoading } from '../contexts/LoadingContext';
import { useCreditScore } from '../hooks/useCreditScore';

const muiTheme = createTheme();

// ─── Full provider wrapper ─────────────────────────────────────────────────────

const FullWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={muiTheme}>
    <LoadingProvider>
      <ToastProvider>
        <PersistenceProvider>
          {children}
        </PersistenceProvider>
      </ToastProvider>
    </LoadingProvider>
  </ThemeProvider>
);

// ─── useToast integration ─────────────────────────────────────────────────────

describe('useToast (integration)', () => {
  it('adds and removes a toast within the full provider tree', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper: FullWrapper });

    act(() => { result.current.success('Saved!'); });
    expect(result.current.toasts[0].message).toBe('Saved!');
    expect(result.current.toasts[0].type).toBe('success');

    act(() => { result.current.dismissAll(); });
    expect(result.current.toasts).toHaveLength(0);
    jest.useRealTimers();
  });

  it('resolves a promise toast to success inside full tree', async () => {
    const { result } = renderHook(() => useToast(), { wrapper: FullWrapper });

    await act(async () => {
      await result.current.promise(
        Promise.resolve(42),
        { loading: 'Working…', success: 'All done', error: 'Oops' }
      );
    });

    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('All done');
  });
});

// ─── usePersistence integration ───────────────────────────────────────────────

describe('usePersistence (integration)', () => {
  it('persists and retrieves language preference', () => {
    const { result } = renderHook(() => usePersistence(), { wrapper: FullWrapper });

    act(() => { result.current.updatePreferences({ language: 'fr' }); });
    expect(result.current.preferences.language).toBe('fr');
  });

  it('manages recent searches correctly', () => {
    const { result } = renderHook(() => usePersistence(), { wrapper: FullWrapper });

    act(() => {
      result.current.addRecentSearch('bitcoin');
      result.current.addRecentSearch('ethereum');
    });

    expect(result.current.preferences.recentSearches).toContain('bitcoin');
    expect(result.current.preferences.recentSearches).toContain('ethereum');
    expect(result.current.preferences.recentSearches![0]).toBe('ethereum');
  });

  it('clears all data including recent searches', () => {
    const { result } = renderHook(() => usePersistence(), { wrapper: FullWrapper });

    act(() => {
      result.current.updatePreferences({ language: 'en' });
      result.current.addRecentSearch('stellar');
    });

    act(() => { result.current.clearAllData(); });
    expect(result.current.preferences).toEqual({});
  });
});

// ─── useLoading integration ───────────────────────────────────────────────────

describe('useLoading (integration)', () => {
  it('reflects loading state changes inside full provider tree', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useLoading(), { wrapper: FullWrapper });

    act(() => { result.current.startLoading(); });
    act(() => { jest.advanceTimersByTime(200); });
    expect(result.current.isLoading).toBe(true);

    act(() => { result.current.stopLoading(); });
    expect(result.current.isLoading).toBe(false);
    jest.useRealTimers();
  });
});

// ─── useCreditScore integration ───────────────────────────────────────────────

describe('useCreditScore (integration)', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('returns loading initially then resolves mock data', async () => {
    const { result } = renderHook(
      () => useCreditScore({ mockData: true }),
      { wrapper: FullWrapper }
    );

    expect(result.current.loading).toBe(true);
    act(() => { jest.advanceTimersByTime(1100); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.data!.currentScore).toBeGreaterThanOrEqual(0);
    expect(result.current.data!.currentScore).toBeLessThanOrEqual(100);
  });

  it('handles API error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(
      () => useCreditScore({ mockData: false }),
      { wrapper: FullWrapper }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Fetch failed');
    expect(result.current.data).toBeNull();

    jest.restoreAllMocks();
  });
});
