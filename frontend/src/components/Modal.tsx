import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Box,
  Backdrop,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import FocusTrap from 'focus-trap-react';
import { ModalConfig } from '../contexts/ModalContext';

interface ModalProps extends Omit<ModalConfig, 'id'> {
  open: boolean;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({
  title,
  content,
  actions,
  size = 'medium',
  open,
  onClose,
  disableBackdropClick = false,
  disableEscapeKey = false,
  maxWidth = 'md',
  fullWidth = true,
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dialogRef = useRef(null);

  // Size mapping for modal dimensions
  const sizeConfig = {
    small: { maxWidth: '400px' },
    medium: { maxWidth: '600px' },
    large: { maxWidth: '900px' },
    full: { maxWidth: '95vw' },
  };

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      onClose();
    }
  };

  const handleEscapeKey = (event: any) => {
    if (!disableEscapeKey && event.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [open, disableEscapeKey]);

  return (
    <FocusTrap active={open} focusTrapOptions={{ initialFocus: false }}>
      <Dialog
        ref={dialogRef}
        open={open}
        onClose={onClose}
        maxWidth={maxWidth}
        fullWidth={fullWidth}
        className={className}
        onBackdropClick={handleBackdropClick}
        TransitionProps={{
          timeout: {
            enter: 300,
            exit: 200,
          },
        }}
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: {
            enter: 300,
            exit: 200,
          },
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            ...sizeConfig[size],
          },
        }}
        aria-labelledby="modal-title"
        aria-describedby="modal-content"
      >
        {title && (
          <DialogTitle
            id="modal-title"
            sx={{
              fontWeight: 600,
              fontSize: '1.25rem',
              pb: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            {title}
          </DialogTitle>
        )}

        <DialogContent
          id="modal-content"
          sx={{
            py: 3,
            px: 3,
            minHeight: isMobile ? '200px' : '300px',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: theme.palette.grey[100],
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.grey[400],
              borderRadius: '4px',
              '&:hover': {
                background: theme.palette.grey[600],
              },
            },
          }}
        >
          {typeof content === 'string' ? <Box>{content}</Box> : content}
        </DialogContent>

        {actions && actions.length > 0 && (
          <DialogActions
            sx={{
              p: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
              gap: 1,
            }}
          >
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                variant={action.variant === 'primary' ? 'contained' : 'outlined'}
                color={action.variant === 'danger' ? 'error' : 'primary'}
                sx={{
                  minWidth: '100px',
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                {action.label}
              </Button>
            ))}
          </DialogActions>
        )}
      </Dialog>
    </FocusTrap>
  );
};

export default Modal;
