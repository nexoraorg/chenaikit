import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadingProvider, useLoading } from '../LoadingContext';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LoadingProvider>{children}</LoadingProvider>
);

// Consumer component for integration tests
const Consumer: React.FC = () => {
  const { isLoading, startLoading, stopLoading } = useLoading();
  return (
    <div>
      <span data-testid="status">{isLoading ? 'loading' : 'idle'}</span>
      <button onClick={startLoading}>start</button>
      <button onClick={stopLoading}>stop</button>
    </div>
  );
};

describe('contexts/LoadingContext', () => {
  // ─── useLoading outside provider ──────────────────────────────────────────

  describe('useLoading', () => {
    it('throws when used outside LoadingProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useLoading())).toThrow(
        'useLoading must be used within a LoadingProvider'
      );
      spy.mockRestore();
    });
  });

  // ─── initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with isLoading=false', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });
      expect(result.current.isLoading).toBe(false);
    });

    it('exposes startLoading and stopLoading functions', () => {
      const { result } = renderHook(() => useLoading(), { wrapper });
      expect(typeof result.current.startLoading).toBe('function');
      expect(typeof result.current.stopLoading).toBe('function');
    });
  });

  // ─── startLoading / stopLoading ───────────────────────────────────────────

  describe('startLoading() and stopLoading()', () => {
    it('sets isLoading=true after the debounce delay', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => { result.current.startLoading(); });
      // Before debounce fires (150ms), still false
      expect(result.current.isLoading).toBe(false);

      act(() => { jest.advanceTimersByTime(200); });
      expect(result.current.isLoading).toBe(true);
      jest.useRealTimers();
    });

    it('sets isLoading=false after stopLoading()', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => { result.current.startLoading(); });
      act(() => { jest.advanceTimersByTime(200); });
      expect(result.current.isLoading).toBe(true);

      act(() => { result.current.stopLoading(); });
      expect(result.current.isLoading).toBe(false);
      jest.useRealTimers();
    });

    it('does not flicker for rapid start/stop within debounce window', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => { result.current.startLoading(); });
      act(() => { result.current.stopLoading(); });
      act(() => { jest.advanceTimersByTime(200); });
      // stopLoading cleared the count before debounce fired — stays false
      expect(result.current.isLoading).toBe(false);
      jest.useRealTimers();
    });

    it('stays loading until all nested starts are matched by stops', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading();
        result.current.startLoading();
      });
      act(() => { jest.advanceTimersByTime(200); });
      expect(result.current.isLoading).toBe(true);

      act(() => { result.current.stopLoading(); }); // count → 1
      expect(result.current.isLoading).toBe(true);

      act(() => { result.current.stopLoading(); }); // count → 0
      expect(result.current.isLoading).toBe(false);
      jest.useRealTimers();
    });

    it('never goes below 0 — extra stopLoading calls are safe', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => { result.current.startLoading(); });
      act(() => { jest.advanceTimersByTime(200); });
      act(() => { result.current.stopLoading(); });
      act(() => { result.current.stopLoading(); }); // extra — should not throw
      expect(result.current.isLoading).toBe(false);
      jest.useRealTimers();
    });
  });

  // ─── integration with UI ──────────────────────────────────────────────────

  describe('UI integration', () => {
    it('renders children', () => {
      render(
        <LoadingProvider>
          <span data-testid="child">content</span>
        </LoadingProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('consumer reflects loading state changes via buttons', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <LoadingProvider>
          <Consumer />
        </LoadingProvider>
      );

      expect(screen.getByTestId('status').textContent).toBe('idle');

      await user.click(screen.getByText('start'));
      act(() => { jest.advanceTimersByTime(200); });
      expect(screen.getByTestId('status').textContent).toBe('loading');

      await user.click(screen.getByText('stop'));
      expect(screen.getByTestId('status').textContent).toBe('idle');
      jest.useRealTimers();
    });
  });
});
