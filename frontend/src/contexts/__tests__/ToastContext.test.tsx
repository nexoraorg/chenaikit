import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { ToastProvider, useToastContext } from '../ToastContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('contexts/ToastContext', () => {
  // ─── useToastContext outside provider ─────────────────────────────────────

  describe('useToastContext', () => {
    it('throws when used outside ToastProvider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useToastContext())).toThrow();
      spy.mockRestore();
    });
  });

  // ─── default config ───────────────────────────────────────────────────────

  describe('default config', () => {
    it('exposes default config values', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      expect(result.current.config.position).toBe('bottom-left');
      expect(result.current.config.defaultDuration).toBeGreaterThan(0);
      expect(result.current.config.maxToasts).toBeGreaterThan(0);
    });

    it('merges user config over defaults', () => {
      const customWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ToastProvider config={{ position: 'top-right', maxToasts: 3 }}>
          {children}
        </ToastProvider>
      );
      const { result } = renderHook(() => useToastContext(), { wrapper: customWrapper });
      expect(result.current.config.position).toBe('top-right');
      expect(result.current.config.maxToasts).toBe(3);
    });
  });

  // ─── show() ───────────────────────────────────────────────────────────────

  describe('show()', () => {
    it('adds a toast and returns an ID string', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Hello'); });
      expect(typeof id!).toBe('string');
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Hello');
    });

    it('defaults type to "info"', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      act(() => { result.current.show('Default type'); });
      expect(result.current.toasts[0].type).toBe('info');
    });

    it('stores toasts in newest-first order', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      act(() => {
        result.current.show('First');
        result.current.show('Second');
      });
      expect(result.current.toasts[0].message).toBe('Second');
      expect(result.current.toasts[1].message).toBe('First');
    });

    it('auto-dismisses after the configured duration', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToastContext(), { wrapper });
      act(() => { result.current.show('Timed', { duration: 500 }); });
      expect(result.current.toasts).toHaveLength(1);
      act(() => { jest.advanceTimersByTime(500 + 400); }); // duration + exit animation
      expect(result.current.toasts).toHaveLength(0);
      jest.useRealTimers();
    });

    it('does NOT auto-dismiss when duration is 0', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToastContext(), { wrapper });
      act(() => { result.current.show('Sticky', { duration: 0 }); });
      act(() => { jest.advanceTimersByTime(60_000); });
      expect(result.current.toasts).toHaveLength(1);
      jest.useRealTimers();
    });
  });

  // ─── typed convenience methods ────────────────────────────────────────────

  describe('success / error / warning / info', () => {
    (['success', 'error', 'warning', 'info'] as const).forEach((type) => {
      it(`${type}() creates a toast with type "${type}"`, () => {
        const { result } = renderHook(() => useToastContext(), { wrapper });
        act(() => { result.current[type](`${type} message`); });
        expect(result.current.toasts[0].type).toBe(type);
      });
    });
  });

  // ─── dismiss() ────────────────────────────────────────────────────────────

  describe('dismiss()', () => {
    it('marks the target toast as dismissing', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToastContext(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Bye', { duration: 0 }); });
      act(() => { result.current.dismiss(id!); });
      const toast = result.current.toasts.find((t) => t.id === id!);
      expect(toast?.dismissing).toBe(true);
      jest.useRealTimers();
    });

    it('removes the toast after the exit animation (~300ms)', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToastContext(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Bye', { duration: 0 }); });
      act(() => { result.current.dismiss(id!); });
      act(() => { jest.advanceTimersByTime(400); });
      expect(result.current.toasts.find((t) => t.id === id!)).toBeUndefined();
      jest.useRealTimers();
    });
  });

  // ─── dismissAll() ─────────────────────────────────────────────────────────

  describe('dismissAll()', () => {
    it('immediately clears all toasts', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      act(() => {
        result.current.show('A', { duration: 0 });
        result.current.show('B', { duration: 0 });
        result.current.show('C', { duration: 0 });
      });
      expect(result.current.toasts).toHaveLength(3);
      act(() => { result.current.dismissAll(); });
      expect(result.current.toasts).toHaveLength(0);
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('swaps message and type of an existing toast', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Loading…', { type: 'info', duration: 0 }); });
      act(() => { result.current.update(id!, 'Done!', { type: 'success' }); });
      const toast = result.current.toasts.find((t) => t.id === id!);
      expect(toast?.message).toBe('Done!');
      expect(toast?.type).toBe('success');
    });

    it('resets dismissing flag to false on update', () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Msg', { duration: 0 }); });
      act(() => { result.current.update(id!, 'Updated'); });
      const toast = result.current.toasts.find((t) => t.id === id!);
      expect(toast?.dismissing).toBe(false);
    });
  });

  // ─── promise() ────────────────────────────────────────────────────────────

  describe('promise()', () => {
    it('shows loading toast then success toast on resolve', async () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      await act(async () => {
        await result.current.promise(
          Promise.resolve('ok'),
          { loading: 'Working…', success: 'Done!', error: 'Oops' }
        );
      });
      const toast = result.current.toasts[0];
      expect(toast.message).toBe('Done!');
      expect(toast.type).toBe('success');
    });

    it('shows error toast and rethrows on rejection', async () => {
      const { result } = renderHook(() => useToastContext(), { wrapper });
      await act(async () => {
        await expect(
          result.current.promise(
            Promise.reject(new Error('boom')),
            { loading: 'Working…', success: 'Done!', error: 'Failed!' }
          )
        ).rejects.toThrow('boom');
      });
      const toast = result.current.toasts[0];
      expect(toast.message).toBe('Failed!');
      expect(toast.type).toBe('error');
    });
  });

  // ─── renders children ─────────────────────────────────────────────────────

  describe('renders children', () => {
    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <span data-testid="child">hello</span>
        </ToastProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
