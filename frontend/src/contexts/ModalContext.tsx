import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';

export interface ModalConfig {
  /** Unique identifier for this modal instance */
  id: string;
  /** Modal title (rendered in the header) */
  title?: React.ReactNode;
  /** Modal content */
  content: React.ReactNode;
  /** Size variant. Defaults to 'sm'. */
  size?: ModalSize;
  /** Whether clicking the backdrop closes the modal. Defaults to true. */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the modal. Defaults to true. */
  closeOnEscape?: boolean;
  /** Custom styles applied to the modal container */
  sx?: Record<string, unknown>;
  /** Whether to show the close icon in the header. Defaults to true. */
  showCloseIcon?: boolean;
  /** Callback fired when the modal is closed */
  onClose?: () => void;
  /** Callback fired after the modal has fully opened */
  onOpened?: () => void;
  /** Callback fired after the close animation completes */
  onClosed?: () => void;
  /** Whether the modal should be full-width within its size breakpoint */
  fullWidth?: boolean;
  /** Arbitrary extra data consumers can attach */
  data?: unknown;
}

export interface ConfirmDialogOptions {
  title?: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'info' | 'success';
  variant?: 'default' | 'danger' | 'warning' | 'info';
  size?: ModalSize;
}

// ─── Context value ───────────────────────────────────────────────────────────

export interface ModalContextValue {
  /** Currently open modals in LIFO order */
  modals: ModalConfig[];
  /** Open a modal. Returns the generated ID. */
  open: (config: Omit<ModalConfig, 'id'>) => string;
  /** Close a modal by ID */
  close: (id: string) => void;
  /** Close the topmost modal */
  closeTop: () => void;
  /** Close all modals */
  closeAll: () => void;
  /** Open a confirm dialog. Resolves to true if confirmed, false otherwise. */
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'OPEN'; modal: ModalConfig }
  | { type: 'CLOSE'; id: string }
  | { type: 'CLOSE_ALL' };

function reducer(state: ModalConfig[], action: Action): ModalConfig[] {
  switch (action.type) {
    case 'OPEN':
      return [...state, action.modal];
    case 'CLOSE':
      return state.filter((m) => m.id !== action.id);
    case 'CLOSE_ALL':
      return [];
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

let _modalIdCounter = 0;
const generateModalId = (): string => `modal-${Date.now()}-${++_modalIdCounter}`;

export interface ModalProviderProps {
  children: React.ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modals, dispatch] = useReducer(reducer, []);
  const confirmResolvers = useRef<Map<string, (value: boolean) => void>>(new Map());

  const open = useCallback((config: Omit<ModalConfig, 'id'>): string => {
    const id = generateModalId();
    const modal: ModalConfig = {
      id,
      size: 'sm',
      closeOnBackdropClick: true,
      closeOnEscape: true,
      showCloseIcon: true,
      fullWidth: true,
      ...config,
    };
    dispatch({ type: 'OPEN', modal });
    // Fire onOpened callback after render
    requestAnimationFrame(() => {
      modal.onOpened?.();
    });
    return id;
  }, []);

  const close = useCallback((id: string) => {
    const modal = modals.find((m) => m.id === id);
    dispatch({ type: 'CLOSE', id });
    modal?.onClose?.();
    requestAnimationFrame(() => {
      modal?.onClosed?.();
    });
  }, [modals]);

  const closeTop = useCallback(() => {
    if (modals.length > 0) {
      const top = modals[modals.length - 1];
      close(top.id);
    }
  }, [modals, close]);

  const closeAll = useCallback(() => {
    const currentModals = [...modals];
    dispatch({ type: 'CLOSE_ALL' });
    currentModals.forEach((modal) => {
      modal.onClose?.();
      requestAnimationFrame(() => modal.onClosed?.());
    });
  }, [modals]);

  const confirm = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        const id = generateModalId();
        confirmResolvers.current.set(id, resolve);

        const handleConfirm = () => {
          confirmResolvers.current.delete(id);
          close(id);
          resolve(true);
        };

        const handleCancel = () => {
          confirmResolvers.current.delete(id);
          close(id);
          resolve(false);
        };

        const variant = options.variant ?? 'default';
        const confirmColor = options.confirmColor ??
          (variant === 'danger' ? 'error' :
           variant === 'warning' ? 'warning' :
           'primary');

        const modal: ModalConfig = {
          id,
          title: options.title ?? (
            variant === 'danger' ? 'Confirm Action' :
            variant === 'warning' ? 'Warning' :
            'Confirm'
          ),
          content: options.message,
          size: options.size ?? 'sm',
          closeOnBackdropClick: false,
          closeOnEscape: true,
          showCloseIcon: true,
          data: {
            type: 'confirm',
            confirmLabel: options.confirmLabel ?? 'Confirm',
            cancelLabel: options.cancelLabel ?? 'Cancel',
            confirmColor,
            variant,
            onConfirm: handleConfirm,
            onCancel: handleCancel,
          },
          onClose: handleCancel,
        };

        dispatch({ type: 'OPEN', modal });
      });
    },
    [close]
  );

  const value: ModalContextValue = {
    modals,
    open,
    close,
    closeTop,
    closeAll,
    confirm,
  };

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
};

// ─── Consumer hook ───────────────────────────────────────────────────────────

export const useModalContext = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return ctx;
};

export default ModalContext;
