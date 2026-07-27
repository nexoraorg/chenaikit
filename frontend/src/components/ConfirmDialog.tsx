import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { ModalSize } from '../contexts/ModalContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Dialog title */
  title?: React.ReactNode;
  /** Dialog body message */
  message: React.ReactNode;
  /** Label for the confirm button. Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to 'Cancel'. */
  cancelLabel?: string;
  /** Color of the confirm button. Defaults to 'primary'. */
  confirmColor?: 'primary' | 'error' | 'warning' | 'info' | 'success';
  /** Variant affects icon and default styles. */
  variant?: 'default' | 'danger' | 'warning' | 'info';
  /** Size of the dialog. Defaults to 'sm'. */
  size?: ModalSize;
  /** Whether the dialog is loading */
  loading?: boolean;
  /** Callback when confirm is clicked */
  onConfirm: () => void;
  /** Callback when dialog is closed / cancelled */
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A standalone confirmation dialog component.
 *
 * This component is useful for quick confirmations without needing the ModalProvider.
 * For a more integrated experience, use `useDialog().confirm()` instead.
 *
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item? This action cannot be undone."
 *   variant="danger"
 *   confirmLabel="Delete"
 *   onConfirm={handleDelete}
 *   onCancel={() => setOpen(false)}
 * />
 * ```
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'primary',
  variant = 'default',
  size = 'sm',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const titleText = title ?? (
    variant === 'danger' ? 'Confirm Action' :
    variant === 'warning' ? 'Warning' :
    'Confirm'
  );

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth={size === 'xs' ? 'xs' : size === 'md' ? 'md' : 'sm'}
      fullWidth
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        id="confirm-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          pt: 2.5,
          pb: 1.5,
          fontWeight: 700,
          fontSize: '1.125rem',
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
          {titleText}
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onCancel}
          size="small"
          disabled={loading}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent id="confirm-dialog-description" sx={{ px: 3, py: 2 }}>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
