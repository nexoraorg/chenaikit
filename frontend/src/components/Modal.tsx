import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  Fade,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { ModalConfig, ModalSize } from '../contexts/ModalContext';
import { useModalContext } from '../contexts/ModalContext';

// ─── Styled sub-components ───────────────────────────────────────────────────

interface ModalHeaderProps {
  title?: React.ReactNode;
  showCloseIcon?: boolean;
  onClose?: () => void;
  id: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  showCloseIcon,
  onClose,
  id,
}) => {
  if (!title && !showCloseIcon) return null;

  return (
    <DialogTitle
      id={`${id}-title`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        pt: 2.5,
        pb: title ? 1.5 : 1,
        m: 0,
        fontWeight: 700,
        fontSize: '1.125rem',
      }}
    >
      {title && (
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
          {title}
        </Typography>
      )}
      {showCloseIcon && onClose && (
        <IconButton
          aria-label="Close dialog"
          onClick={onClose}
          size="small"
          sx={{
            ml: 'auto',
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              backgroundColor: 'action.hover',
            },
            transition: 'color 0.2s ease',
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </DialogTitle>
  );
};

interface ModalBodyProps {
  children: React.ReactNode;
  id: string;
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, id }) => (
  <DialogContent
    id={`${id}-description`}
    sx={{
      px: 3,
      py: 2,
      overflowY: 'auto',
      '&:first-of-type': {
        pt: 2,
      },
    }}
  >
    {children}
  </DialogContent>
);

interface ModalFooterProps {
  children?: React.ReactNode;
}

const ModalFooter: React.FC<ModalFooterProps> = ({ children }) => {
  if (!children) return null;

  return (
    <DialogActions
      sx={{
        px: 3,
        pb: 2.5,
        pt: 1.5,
        gap: 1,
        justifyContent: 'flex-end',
      }}
    >
      {children}
    </DialogActions>
  );
};

// ─── Confirm dialog content ──────────────────────────────────────────────────

interface ConfirmContentProps {
  config: ModalConfig;
  onClose: () => void;
}

const ConfirmContent: React.FC<ConfirmContentProps> = ({ config, onClose }) => {
  const data = config.data as Record<string, unknown> | undefined;
  if (data?.type !== 'confirm') return null;

  const confirmLabel = data.confirmLabel as string ?? 'Confirm';
  const cancelLabel = data.cancelLabel as string ?? 'Cancel';
  const confirmColor = data.confirmColor as string ?? 'primary';
  const onConfirm = data.onConfirm as () => void;
  const onCancel = data.onCancel as () => void;

  return (
    <>
      <ModalBody id={config.id}>
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
          {config.content}
        </Typography>
      </ModalBody>
      <ModalFooter>
        <Box sx={{ display: 'flex', gap: 1.5, width: '100%', justifyContent: 'flex-end' }}>
          <Button
            onClick={onCancel || onClose}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            variant="contained"
            color={confirmColor as 'primary' | 'error' | 'warning' | 'info' | 'success'}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            {confirmLabel}
          </Button>
        </Box>
      </ModalFooter>
    </>
  );
};

// ─── Size to maxWidth mapping ────────────────────────────────────────────────

const SIZE_TO_MAX_WIDTH: Record<ModalSize, 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  fullscreen: false,
};

// ─── Modal item ──────────────────────────────────────────────────────────────

interface ModalItemProps {
  config: ModalConfig;
  onClose: (id: string) => void;
  zIndex: number;
}

const ModalItem: React.FC<ModalItemProps> = ({ config, onClose, zIndex }) => {
  const theme = useTheme();
  const isFullscreen = config.size === 'fullscreen';
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm')) || isFullscreen;

  const handleClose = useCallback(() => {
    if (!config.closeOnBackdropClick) return;
    onClose(config.id);
  }, [config.closeOnBackdropClick, config.id, onClose]);

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && config.closeOnEscape) {
        onClose(config.id);
      }
    },
    [config.closeOnEscape, config.id, onClose]
  );

  useEffect(() => {
    if (!config.closeOnEscape) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [config.closeOnEscape, handleEscape]);

  // Manage body scroll lock
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const isConfirm = (config.data as Record<string, unknown> | undefined)?.type === 'confirm';

  return (
    <Fade in={true} timeout={300}>
      <Dialog
        open={true}
        onClose={handleClose}
        maxWidth={SIZE_TO_MAX_WIDTH[config.size ?? 'sm']}
        fullWidth={config.fullWidth ?? true}
        fullScreen={fullScreen}
        aria-labelledby={`${config.id}-title`}
        aria-describedby={`${config.id}-description`}
        aria-modal="true"
        role="dialog"
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            backgroundImage: 'none',
            overflow: 'hidden',
            ...(config.sx as Record<string, unknown> ?? {}),
          },
        }}
        sx={{ zIndex }}
      >
        {isConfirm ? (
          <>
            <ModalHeader
              title={config.title}
              showCloseIcon={config.showCloseIcon}
              onClose={() => onClose(config.id)}
              id={config.id}
            />
            <ConfirmContent config={config} onClose={() => onClose(config.id)} />
          </>
        ) : (
          <>
            <ModalHeader
              title={config.title}
              showCloseIcon={config.showCloseIcon}
              onClose={() => onClose(config.id)}
              id={config.id}
            />
            <ModalBody id={config.id}>{config.content}</ModalBody>
          </>
        )}
      </Dialog>
    </Fade>
  );
};

// ─── Modal container ─────────────────────────────────────────────────────────

/**
 * Renders all active modals as stacked MUI Dialogs with consistent styling.
 * Place this once in your app tree inside ModalProvider.
 */
const ModalContainer: React.FC = () => {
  const { modals, close } = useModalContext();

  if (modals.length === 0) return null;

  return (
    <>
      {modals.map((modal, index) => (
        <ModalItem
          key={modal.id}
          config={modal}
          onClose={close}
          zIndex={1300 + index * 10}
        />
      ))}
    </>
  );
};

export { ModalContainer, ModalHeader, ModalBody, ModalFooter };
export type { ModalHeaderProps, ModalBodyProps, ModalFooterProps };
export default ModalContainer;
