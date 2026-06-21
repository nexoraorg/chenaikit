import { useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import type { ToastOptions, ToastType } from '../contexts/ToastContext';

/**
 * Primary hook for consuming the toast system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong', { duration: 6000 });
 *   toast.promise(saveData(), { loading: 'Saving…', success: 'Saved!', error: 'Failed' });
 */
const useToast = () => {
  const ctx = useToastContext();

  /**
   * Show a toast with explicit type.
   * Returns the generated toast ID so you can dismiss or update it later.
   */
  const show = useCallback(
    (
      message: React.ReactNode,
      type: ToastType = 'info',
      options?: Omit<ToastOptions, 'type'>
    ) => ctx.show(message, { ...options, type }),
    [ctx]
  );

  return {
    // Typed convenience methods
    success: ctx.success,
    error: ctx.error,
    warning: ctx.warning,
    info: ctx.info,
    // Generic show with explicit type arg
    show,
    // Promise-based API
    promise: ctx.promise,
    // Lifecycle control
    dismiss: ctx.dismiss,
    dismissAll: ctx.dismissAll,
    update: ctx.update,
    // Current toast list – useful for rendering custom UI
    toasts: ctx.toasts,
  };
};

export default useToast;
