import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';
import useToast from '../useToast';

// Wrap every renderHook call in ToastProvider so the hook has a context
const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('hooks/useToast', () => {
  // ─── convenience methods exist ─────────────────────────────────────────────

  describe('API surface', () => {
    it('exposes success, error, warning, info, show, promise, dismiss, dismissAll, update, toasts', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      expect(typeof result.current.success).toBe('function');
      expect(typeof result.current.error).toBe('function');
      expect(typeof result.current.warning).toBe('function');
      expect(typeof result.current.info).toBe('function');
      expect(typeof result.current.show).toBe('function');
      expect(typeof result.current.promise).toBe('function');
      expect(typeof result.current.dismiss).toBe('function');
      expect(typeof result.current.dismissAll).toBe('function');
      expect(typeof result.current.update).toBe('function');
      expect(Array.isArray(result.current.toasts)).toBe(true);
    });
  });

  // ─── success / error / warning / info ─────────────────────────────────────

  describe('typed convenience methods', () => {
    it('success() adds a toast with type "success"', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.success('Great job!'); });
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[0].message).toBe('Great job!');
    });

    it('error() adds a toast with type "error"', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.error('Something went wrong'); });
      expect(result.current.toasts[0].type).toBe('error');
    });

    it('warning() adds a toast with type "warning"', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.warning('Watch out'); });
      expect(result.current.toasts[0].type).toBe('warning');
    });

    it('info() adds a toast with type "info"', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.info('FYI'); });
      expect(result.current.toasts[0].type).toBe('info');
    });
  });

  // ─── show() ───────────────────────────────────────────────────────────────

  describe('show()', () => {
    it('returns a string ID', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Hello', 'info'); });
      expect(typeof id!).toBe('string');
      expect(id!.length).toBeGreaterThan(0);
    });

    it('defaults to type "info" when no type is supplied', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.show('Default'); });
      expect(result.current.toasts[0].type).toBe('info');
    });

    it('respects a custom duration option', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.show('Sticky', 'warning', { duration: 0 }); });
      expect(result.current.toasts[0].duration).toBe(0);
    });

    it('respects a custom position option', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => { result.current.show('Positioned', 'info', { position: 'top-right' }); });
      expect(result.current.toasts[0].position).toBe('top-right');
    });

    it('each call produces a unique ID', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      const ids: string[] = [];
      act(() => {
        ids.push(result.current.show('A', 'info'));
        ids.push(result.current.show('B', 'info'));
        ids.push(result.current.show('C', 'info'));
      });
      expect(new Set(ids).size).toBe(3);
    });
  });

  // ─── dismiss() ────────────────────────────────────────────────────────────

  describe('dismiss()', () => {
    it('marks the toast as dismissing', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToast(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Hi', 'info', { duration: 0 }); });
      act(() => { result.current.dismiss(id!); });
      const toast = result.current.toasts.find((t) => t.id === id!);
      expect(toast?.dismissing).toBe(true);
      jest.useRealTimers();
    });

    it('eventually removes the toast after the exit animation', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useToast(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Hi', 'info', { duration: 0 }); });
      expect(result.current.toasts).toHaveLength(1);
      act(() => { result.current.dismiss(id!); });
      act(() => { jest.advanceTimersByTime(400); });
      expect(result.current.toasts).toHaveLength(0);
      jest.useRealTimers();
    });
  });

  // ─── dismissAll() ─────────────────────────────────────────────────────────

  describe('dismissAll()', () => {
    it('clears all toasts immediately', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.info('One');
        result.current.info('Two');
        result.current.info('Three');
      });
      expect(result.current.toasts.length).toBe(3);
      act(() => { result.current.dismissAll(); });
      expect(result.current.toasts).toHaveLength(0);
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('changes the message of an existing toast', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      let id: string;
      act(() => { id = result.current.show('Loading...', 'info', { duration: 0 }); });
      act(() => { result.current.update(id!, 'Done!', { type: 'success' }); });
      const toast = result.current.toasts.find((t) => t.id === id!);
      expect(toast?.message).toBe('Done!');
      expect(toast?.type).toBe('success');
    });
  });

  // ─── promise() ────────────────────────────────────────────────────────────

  describe('promise()', () => {
    it('resolves to the promise value and shows success message', async () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      let resolved: string;
      await act(async () => {
        resolved = await result.current.promise(
          Promise.resolve('data'),
          { loading: 'Loading…', success: 'Done!', error: 'Failed' }
        );
      });
      expect(resolved!).toBe('data');
      const toast = result.current.toasts[0];
      expect(toast.message).toBe('Done!');
      expect(toast.type).toBe('success');
    });

    it('shows error message and rethrows when promise rejects', async () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      await act(async () => {
        await expect(
          result.current.promise(
            Promise.reject(new Error('oops')),
            { loading: 'Loading…', success: 'Done!', error: 'Failed' }
          )
        ).rejects.toThrow('oops');
      });
      const toast = result.current.toasts[0];
      expect(toast.message).toBe('Failed');
      expect(toast.type).toBe('error');
    });
  });

  // ─── toasts list ──────────────────────────────────────────────────────────

  describe('toasts list', () => {
    it('starts empty', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      expect(result.current.toasts).toHaveLength(0);
    });

    it('accumulates toasts in newest-first order', () => {
      const { result } = renderHook(() => useToast(), { wrapper });
      act(() => {
        result.current.info('First');
        result.current.info('Second');
      });
      expect(result.current.toasts[0].message).toBe('Second');
      expect(result.current.toasts[1].message).toBe('First');
    });
  });
});
