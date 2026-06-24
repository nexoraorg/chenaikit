import React from 'react';
import { Box, Button } from '@mui/material';
import Dialog from './Dialog';

export interface FormModalProps {
  open: boolean;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

const FormModal: React.FC<FormModalProps> = ({
  open,
  title,
  description,
  icon,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting = false,
  onSubmit,
  onCancel,
  fullScreen = false,
  size = 'medium',
  closeOnBackdropClick = true,
  closeOnEscape = true,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      icon={icon}
      size={size}
      fullScreen={fullScreen}
      closeOnBackdropClick={closeOnBackdropClick}
      closeOnEscape={closeOnEscape}
      content={children}
      actions={
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={onCancel} variant="text">
            {cancelLabel}
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            disabled={submitting}
            autoFocus
          >
            {submitting ? 'Submitting…' : submitLabel}
          </Button>
        </Box>
      }
    />
  );
};

export default FormModal;
