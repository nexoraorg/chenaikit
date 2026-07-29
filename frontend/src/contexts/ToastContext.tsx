import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Toast variant – defaults to 'info' */
  type?: ToastType;
  /** Duration in ms before auto-dismiss. Set to 0 to disable. Defaults to 4000. */
  duration?: number;
  /** Where the stack appears on screen. Defaults to global config or 'bottom-left'. */
  position?: ToastPosition;
  /** Optional action button rendered inside the toast. */
  action?: ToastAction;
  /** Whether to show a progress bar for the countdown. Defaults to true when duration > 0. */
  showProgress?: boolean;
  /** Arbitrary extra data consumers can attach. */
  data?: unknown;
}

export interface Toast extends Required<Omit<ToastOptions, 'data'>> {
  id: string;
  message: React.ReactNode;
  data?: unknown;
  /** Timestamp when the toast was created. Used to compute progress bar width. */
  createdAt: number;
  /** Whether the toast is animating out before removal. */
  dismissing: boolean;
}

export interface GlobalToastConfig {
  position?: ToastPosition;
  defaultDuration?: number;
  maxToasts?: number;
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface ToastContextValue {
  toasts: Toast[];
  config: Required<GlobalToastConfig>;
  /** Show a toast. Returns the generated ID. */
  show: (message: React.ReactNode, options?: ToastOptions) => string;
  success: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  error: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  warning: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  info: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  /** Shows loading toast, swaps to success/error when promise settles. */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: React.ReactNode; success: React.ReactNode; error: React.ReactNode },
    options?: Omit<ToastOptions, 'type'>
  ) => Promise<T>;
  /** Start exit animation then remove after 300 ms. */
  dismiss: (id: string) => void;
  /** Immediately clear all toasts. */
  dismissAll: () => void;
  /** Swap content/type of a live toast (e.g. loading → success). */
  update: (id: string, message: React.ReactNode, options?: ToastOptions) => void;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'REMOVE_ALL' }
  | { type: 'UPDATE'; id: string; message: React.ReactNode; options?: ToastOptions };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state];
    case 'DISMISS':
      return state.map((t) =>
        t.id === action.id ? { ...t, dismissing: true } : t
      );
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    case 'REMOVE_ALL':
      return [];
    case 'UPDATE': {
      const opts = action.options ?? {};
      return state.map((t) => {
        if (t.id !== action.id) return t;
        return {
          ...t,
          message: action.message,
          type: opts.type ?? t.type,
          duration: opts.duration !== undefined ? opts.duration : t.duration,
          position: opts.position ?? t.position,
          action: opts.action ?? t.action,
          showProgress:
            opts.showProgress !== undefined ? opts.showProgress : t.showProgress,
          data: opts.data,
          dismissing: false,
          createdAt: Date.now(),
        };
      });
    }
    default:
      return state;
  }
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<GlobalToastConfig> = {
  position: 'bottom-left',
  defaultDuration: 4000,
  maxToasts: 5,
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export interface ToastProviderProps {
  children: React.ReactNode;
  config?: GlobalToastConfig;
}

let _idCounter = 0;
const generateId = (): string => `toast-${Date.now()}-${++_idCounter}`;

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  config: userConfig,
}) => {
  const [toasts, dispatch] = useReducer(reducer, []);
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // FIX: include userConfig in deps so config updates if props change;
  // removed the eslint-disable comment since react-hooks plugin is not configured.
  const config = React.useMemo<Required<GlobalToastConfig>>(
    () => ({ ...DEFAULT_CONFIG, ...userConfig }),
    [userConfig]
  );

  const scheduleRemove = useCallback((id: string) => {
    const existing = dismissTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE', id });
      dismissTimers.current.delete(id);
    }, 300); // matches Collapse exit timeout
    dismissTimers.current.set(id, timer);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      // FIX: cancel the pending auto-dismiss timer so it doesn't fire after
      // a manual dismiss and try to remove an already-removed toast.
      const autoKey = `${id}_auto`;
      const autoTimer = dismissTimers.current.get(autoKey);
      if (autoTimer) {
        clearTimeout(autoTimer);
        dismissTimers.current.delete(autoKey);
      }

      dispatch({ type: 'DISMISS', id });
      scheduleRemove(id);
    },
    [scheduleRemove]
  );

  const dismissAll = useCallback(() => {
    dispatch({ type: 'REMOVE_ALL' });
    dismissTimers.current.forEach((t) => clearTimeout(t));
    dismissTimers.current.clear();
  }, []);

  const show = useCallback(
    (message: React.ReactNode, options: ToastOptions = {}): string => {
      const id = generateId();
      const duration =
        options.duration !== undefined ? options.duration : config.defaultDuration;

      const toast: Toast = {
        id,
        message,
        type: options.type ?? 'info',
        duration,
        position: options.position ?? config.position,
        action: options.action ?? { label: '', onClick: () => undefined },
        showProgress:
          options.showProgress !== undefined ? options.showProgress : duration > 0,
        data: options.data,
        createdAt: Date.now(),
        dismissing: false,
      };

      // FIX: removed the no-op thunk dispatch — useReducer dispatch doesn't
      // accept a function. ToastContainer already caps visible toasts with slice().
      dispatch({ type: 'ADD', toast });

      if (duration > 0) {
        const autoKey = `${id}_auto`;
        const timer = setTimeout(() => {
          // Clean up the timer entry before dismissing
          dismissTimers.current.delete(autoKey);
          dismiss(id);
        }, duration);
        dismissTimers.current.set(autoKey, timer);
      }

      return id;
    },
    [config.defaultDuration, config.position, dismiss]
  );

  const success = useCallback(
    (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) =>
      show(message, { ...options, type: 'success' }),
    [show]
  );

  const error = useCallback(
    (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) =>
      show(message, { ...options, type: 'error' }),
    [show]
  );

  const warning = useCallback(
    (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) =>
      show(message, { ...options, type: 'warning' }),
    [show]
  );

  const info = useCallback(
    (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) =>
      show(message, { ...options, type: 'info' }),
    [show]
  );

  const update = useCallback(
    (id: string, message: React.ReactNode, options?: ToastOptions) => {
      const autoKey = `${id}_auto`;
      const existing = dismissTimers.current.get(autoKey);
      if (existing) {
        clearTimeout(existing);
        dismissTimers.current.delete(autoKey);
      }

      // FIX: compute duration + showProgress here and include them in the
      // dispatch payload so the reducer (and thus the UI) stays in sync with
      // the timer being scheduled below. This matters especially when updating
      // a duration:0 loading toast to a success/error toast with a countdown.
      const duration =
        options?.duration !== undefined ? options.duration : config.defaultDuration;
      const showProgress =
        options?.showProgress !== undefined ? options.showProgress : duration > 0;

      dispatch({
        type: 'UPDATE',
        id,
        message,
        options: { ...options, duration, showProgress },
      });

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissTimers.current.delete(autoKey);
          dismiss(id);
        }, duration);
        dismissTimers.current.set(autoKey, timer);
      }
    },
    [config.defaultDuration, dismiss]
  );

  const promise = useCallback(
    async <T,>(
      p: Promise<T>,
      messages: {
        loading: React.ReactNode;
        success: React.ReactNode;
        error: React.ReactNode;
      },
      options?: Omit<ToastOptions, 'type'>
    ): Promise<T> => {
      const id = show(messages.loading, { ...options, type: 'info', duration: 0 });
      try {
        const result = await p;
        update(id, messages.success, { ...options, type: 'success' });
        return result;
      } catch (err) {
        update(id, messages.error, { ...options, type: 'error' });
        throw err;
      }
    },
    [show, update]
  );

  const value: ToastContextValue = {
    toasts,
    config,
    show,
    success,
    error,
    warning,
    info,
    promise,
    dismiss,
    dismissAll,
    update,
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};

// ─── Consumer hook ────────────────────────────────────────────────────────────

export const useToastContext = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return ctx;
};

export default ToastContext;
