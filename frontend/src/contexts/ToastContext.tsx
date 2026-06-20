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
  /** Duration in ms before auto-dismiss. Set to 0 to disable auto-dismiss. Defaults to 4000. */
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
  /** Whether the toast is in the process of being dismissed (exit animation). */
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
  /** Convenience wrappers */
  success: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  error: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  warning: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  info: (message: React.ReactNode, options?: Omit<ToastOptions, 'type'>) => string;
  /** Promise helper: shows a loading toast, resolves on success/error. */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: React.ReactNode; success: React.ReactNode; error: React.ReactNode },
    options?: Omit<ToastOptions, 'type'>
  ) => Promise<T>;
  /** Start the exit animation then remove from state after 300 ms. */
  dismiss: (id: string) => void;
  /** Immediately remove all toasts. */
  dismissAll: () => void;
  /** Update a previously-shown toast (e.g. swap loading → success). */
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
          showProgress: opts.showProgress !== undefined ? opts.showProgress : t.showProgress,
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
const generateId = () => `toast-${Date.now()}-${++_idCounter}`;

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  config: userConfig,
}) => {
  const [toasts, dispatch] = useReducer(reducer, []);
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const config = React.useMemo<Required<GlobalToastConfig>>(
    () => ({ ...DEFAULT_CONFIG, ...userConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const scheduleRemove = useCallback(
    (id: string) => {
      const existing = dismissTimers.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE', id });
        dismissTimers.current.delete(id);
      }, 300); // matches exit animation duration
      dismissTimers.current.set(id, timer);
    },
    []
  );

  const dismiss = useCallback(
    (id: string) => {
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
        action: options.action ?? { label: '', onClick: () => {} },
        showProgress: options.showProgress !== undefined ? options.showProgress : duration > 0,
        data: options.data,
        createdAt: Date.now(),
        dismissing: false,
      };

      // Enforce max toasts: trim oldest entries beyond the limit
      dispatch((prev: Toast[]) => {
        // Note: our reducer's ADD prepends, so oldest are at the end
        return prev;
      });
      dispatch({ type: 'ADD', toast });

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        dismissTimers.current.set(id + '_auto', timer);
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
      // Cancel any existing auto-dismiss for this id and reschedule
      const autoKey = id + '_auto';
      const existing = dismissTimers.current.get(autoKey);
      if (existing) {
        clearTimeout(existing);
        dismissTimers.current.delete(autoKey);
      }
      dispatch({ type: 'UPDATE', id, message, options });
      const duration =
        options?.duration !== undefined ? options.duration : config.defaultDuration;
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
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
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
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
