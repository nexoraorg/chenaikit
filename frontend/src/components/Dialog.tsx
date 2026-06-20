import React from 'react';
import Modal, { ModalProps } from './Modal';

export interface DialogProps extends Omit<ModalProps, 'children'> {
  content?: React.ReactNode;
  actions?: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ content, actions, ...props }) => {
  return (
    <Modal {...props} actions={actions}>
      {content}
    </Modal>
  );
};

export default Dialog;
