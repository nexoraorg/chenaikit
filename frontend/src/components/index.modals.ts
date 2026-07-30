// Modal Components & Context
export { default as Modal } from './Modal';
export { default as Dialog } from './Dialog';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as FormModal, type FormStep } from './FormModal';

// Context
export {
  ModalProvider,
  useModal,
  type ModalConfig,
} from '../contexts/ModalContext';

// Types
export type { DialogType } from './Dialog';
