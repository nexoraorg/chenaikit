import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FocusTrap from 'focus-trap-react';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export type DialogType = 'info' | 'warning' | 'success' | 'error';

interface DialogComponentProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: DialogType;
  icon?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'danger';
    autoClose?: boolean;
  }>;
  onClose: () => void;
  disableBackdropClick?: boolean;
  disableEscapeKey?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md';
}

const iconMap: Record<DialogType, React.ReactNode> = {
  info: <InfoIcon sx={{ fontSize: '2rem' }} />,
  warning: <WarningIcon sx={{ fontSize: '2rem' }} />,
  success: <CheckCircleIcon sx={{ fontSize: '2rem' }} />,
  error: <ErrorIcon sx={{ fontSize: '2rem' }} />,
};

const colorMap: Record<DialogType, string> = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
};

const DialogComponent: React.FC<DialogComponentProps> = ({
  open,
  title,
  message,
  type = 'info',
  icon,
  actions = [],
  onClose,
  disableBackdropClick = false,
  disableEscapeKey = false,
  maxWidth = 'sm',
}) => {
  const theme = useTheme();

  const handleBackdropClick = () => {
    if (!disableBackdropClick) {
      onClose();
    }
  };

  const handleActionClick = async (action: DialogComponentProps['actions'][0]) => {
    if (action.onClick) {
      await action.onClick();
    }
    if (action.autoClose !== false) {
      onClose();
    }
  };

  const displayIcon = icon || iconMap[type];

  return (
    <FocusTrap active={open} focusTrapOptions={{ initialFocus: false }}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={maxWidth}
        fullWidth
        onBackdropClick={handleBackdropClick}
        TransitionProps={{
          timeout: {
            enter: 300,
            exit: 200,
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          },
        }}
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <DialogTitle id="dialog-title" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {displayIcon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: `${colorMap[type]}.main`,
                }}
              >
                {displayIcon}
              </Box>
            )}
            {title}
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 2 }}>
          <Typography
            id="dialog-message"
            variant="body2"
            color="textSecondary"
            sx={{ mt: 1, lineHeight: 1.6 }}
          >
            {message}
          </Typography>
        </DialogContent>

        {actions.length > 0 && (
          <DialogActions sx={{ p: 2, gap: 1 }}>
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={() => handleActionClick(action)}
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

export default DialogComponent;
