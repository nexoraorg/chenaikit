import React, { createContext, useCallback, useContext, useState } from 'react';

export interface ModalConfig {
  id: string;
  title?: string;
  content: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }>;
  size?: 'small' | 'medium' | 'large' | 'full';
  open: boolean;
  onClose: () => void;
  disableBackdropClick?: boolean;
  disableEscapeKey?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  className?: string;
}

interface ModalContextType {
  modals: Map<string, ModalConfig>;
  openModal: (config: Omit<ModalConfig, 'id' | 'open'>) => string;
  closeModal: (id: string) => void;
  updateModal: (id: string, config: Partial<ModalConfig>) => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modals, setModals] = useState<Map<string, ModalConfig>>(new Map());

  const openModal = useCallback(
    (config: Omit<ModalConfig, 'id' | 'open'>) => {
      const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const modalConfig: ModalConfig = {
        ...config,
        id,
        open: true,
        onClose: () => closeModal(id),
      };
      setModals((prev) => new Map(prev).set(id, modalConfig));
      return id;
    },
    []
  );

  const closeModal = useCallback((id: string) => {
    setModals((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const updateModal = useCallback((id: string, config: Partial<ModalConfig>) => {
    setModals((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...config });
      }
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setModals(new Map());
  }, []);

  return (
    <ModalContext.Provider value={{ modals, openModal, closeModal, updateModal, closeAll }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
