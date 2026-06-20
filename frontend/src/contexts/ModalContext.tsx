import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import Modal from '../components/Modal';
import type { ModalProps } from '../components/Modal';

export type ModalType =
  | 'alert'
  | 'confirm'
  | 'form'
  | 'fullscreen'
  | 'drawer'
  | 'custom';

export interface ModalState extends Omit<ModalProps, 'open'> {
  id: string;
  type: ModalType;
  open: boolean;
}

export interface ModalContextValue {
  openModal: (config: Omit<ModalState, 'id' | 'open'>) => string;
  closeModal: (id: string) => void;
  closeAll: () => void;
  modals: ModalState[];
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

function generateId() {
  return `modal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type Action =
  | { type: 'OPEN'; modal: ModalState }
  | { type: 'CLOSE'; id: string }
  | { type: 'CLOSE_ALL' };

function reducer(state: ModalState[], action: Action): ModalState[] {
  switch (action.type) {
    case 'OPEN':
      return [...state, action.modal];
    case 'CLOSE':
      return state.filter((modal) => modal.id !== action.id);
    case 'CLOSE_ALL':
      return [];
    default:
      return state;
  }
}

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modals, dispatch] = useReducer(reducer, []);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const openModal = useCallback((config: Omit<ModalState, 'id' | 'open'>) => {
    const id = generateId();
    lastFocusedElement.current = document.activeElement as HTMLElement | null;

    dispatch({
      type: 'OPEN',
      modal: {
        ...config,
        id,
        open: true,
      },
    });

    return id;
  }, []);

  const closeModal = useCallback((id: string) => {
    dispatch({ type: 'CLOSE', id });
  }, []);

  const closeAll = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL' });
  }, []);

  React.useEffect(() => {
    if (modals.length === 0 && lastFocusedElement.current) {
      lastFocusedElement.current.focus();
      lastFocusedElement.current = null;
    }
  }, [modals.length]);

  const contextValue = useMemo(
    () => ({ openModal, closeModal, closeAll, modals }),
    [modals, openModal, closeModal, closeAll]
  );

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      {modals.map((modal) => (
        <Modal
          key={modal.id}
          open={modal.open}
          onClose={() => closeModal(modal.id)}
          title={modal.title}
          description={modal.description}
          icon={modal.icon}
          size={modal.size}
          fullScreen={modal.fullScreen}
          showCloseButton={modal.showCloseButton}
          closeOnBackdropClick={modal.closeOnBackdropClick}
          closeOnEscape={modal.closeOnEscape}
          actions={modal.actions}
          progress={modal.progress}
          maxWidth={modal.maxWidth}
          drawer={modal.drawer}
          ariaLabel={modal.ariaLabel}
          ariaDescription={modal.ariaDescription}
        >
          {modal.children}
        </Modal>
      ))}
    </ModalContext.Provider>
  );
};

export function useModalContext(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
}
