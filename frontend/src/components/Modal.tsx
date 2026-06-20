import React, { forwardRef } from 'react';
import {
  Box,
  Button,
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  LinearProgress,
  Slide,
  Typography,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';

const DefaultTransition = forwardRef(function DefaultTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="down" ref={ref} {...props} />;
});

const DrawerTransition = forwardRef(function DrawerTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

export type ModalSize = 'small' | 'medium' | 'large' | 'full';
export type ModalWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  size?: ModalSize;
  fullScreen?: boolean;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  actions?: React.ReactNode;
  progress?: number;
  maxWidth?: ModalWidth;
  drawer?: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
}

const sizeMap: Record<ModalSize, ModalWidth> = {
  small: 'xs',
  medium: 'sm',
  large: 'md',
  full: 'xl',
};

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  actions,
  size = 'medium',
  fullScreen = false,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  progress,
  maxWidth,
  drawer = false,
  ariaLabel,
  ariaDescription,
}) => {
  const handleClose = (
    event: unknown,
    reason: 'backdropClick' | 'escapeKeyDown'
  ) => {
    if (!closeOnBackdropClick && reason === 'backdropClick') {
      return;
    }
    if (!closeOnEscape && reason === 'escapeKeyDown') {
      return;
    }

    onClose();
  };

  return (
    <MuiDialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth={drawer ? false : maxWidth ?? sizeMap[size]}
      fullWidth={!drawer}
      TransitionComponent={drawer ? DrawerTransition : DefaultTransition}
      keepMounted
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      PaperProps={{
        sx: drawer
          ? {
              width: '100%',
              maxWidth: 520,
              m: 0,
              height: '100%',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
            }
          : {
              minWidth: 320,
              borderRadius: 2,
            },
      }}
      BackdropProps={{ sx: { backdropFilter: 'blur(3px)' } }}
    >
      {(title || showCloseButton || icon) && (
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pr: showCloseButton ? 1 : 2,
          }}
        >
          {icon && <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</Box>}
          <Box sx={{ flex: 1 }}>
            {title && (
              <Typography id="modal-title" variant="h6" component="div">
                {title}
              </Typography>
            )}
            {description && (
              <Typography
                id="modal-description"
                variant="body2"
                color="text.secondary"
              >
                {description}
              </Typography>
            )}
          </Box>
          {showCloseButton && (
            <IconButton
              aria-label="Close dialog"
              edge="end"
              onClick={onClose}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}

      {typeof progress === 'number' && progress >= 0 && progress <= 100 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ width: '100%' }}
          aria-label="Progress"
        />
      )}

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>{actions}</DialogActions>
      )}
    </MuiDialog>
  );
};

export default Modal;
