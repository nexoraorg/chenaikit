import React, { useState } from 'react';
import DialogComponent from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  isDangerous?: boolean;
  disableBackdropClick?: boolean;
  disableEscapeKey?: boolean;
  requireConfirmation?: boolean;
  confirmationText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = false,
  disableBackdropClick = false,
  disableEscapeKey = false,
  requireConfirmation = false,
  confirmationText = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleClose = () => {
    setInputValue('');
    onCancel?.();
  };

  const handleConfirm = async () => {
    await onConfirm();
    setInputValue('');
  };

  const isConfirmDisabled =
    requireConfirmation && inputValue !== confirmationText;

  const actions = [
    {
      label: cancelLabel,
      onClick: handleClose,
      variant: 'secondary' as const,
      autoClose: true,
    },
    {
      label: confirmLabel,
      onClick: handleConfirm,
      variant: (isDangerous ? 'danger' : 'primary') as const,
      disabled: isConfirmDisabled || isLoading,
      autoClose: true,
    },
  ];

  let messageContent: React.ReactNode = message;

  if (requireConfirmation) {
    messageContent = (
      <div>
        <div style={{ marginBottom: '1rem' }}>{message}</div>
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            marginBottom: '0.75rem',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              fontWeight: 500,
            }}
          >
            Type "{confirmationText}" to confirm:
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Type "${confirmationText}"`}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
            disabled={isLoading}
          />
        </div>
      </div>
    );
  }

  return (
    <DialogComponent
      open={open}
      title={title}
      message={messageContent}
      type={isDangerous ? 'warning' : 'info'}
      actions={actions}
      onClose={handleClose}
      disableBackdropClick={disableBackdropClick}
      disableEscapeKey={disableEscapeKey}
      maxWidth="sm"
    />
  );
};

export default ConfirmDialog;
