import React from 'react';
import { Box, Button } from '@mui/material';
import Dialog from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  content?: React.ReactNode;
  icon?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  openInDrawer?: boolean;
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  content,
  icon,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmLoading = false,
  onConfirm,
  onCancel,
  fullScreen = false,
  size = 'small',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  openInDrawer = false,
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
      drawer={openInDrawer}
      content={content}
      actions={
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={onCancel} variant="text">
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color="primary"
            disabled={confirmLoading}
            autoFocus
          >
            {confirmLoading ? 'Working…' : confirmText}
          </Button>
        </Box>
      }
    />
  );
};

export default ConfirmDialog;
