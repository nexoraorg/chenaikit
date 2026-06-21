import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Toast as ToastData } from '../contexts/ToastContext';
import { toastTypeToSeverity, toastProgressColor } from '../utils/toastUtils';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  createdAt: number;
  duration: number;
  type: ToastData['type'];
}

/**
 * rAF-driven countdown bar from 100 % → 0 % over `duration` ms.
 */
const ProgressBar: React.FC<ProgressBarProps> = ({ createdAt, duration, type }) => {
  const [value, setValue] = useState(100);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(0, ((duration - elapsed) / duration) * 100);
      setValue(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [createdAt, duration]);

  return (
    <LinearProgress
      variant="determinate"
      value={value}
      aria-hidden="true"
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        borderRadius: '0 0 4px 4px',
        backgroundColor: 'rgba(255,255,255,0.3)',
        '& .MuiLinearProgress-bar': {
          backgroundColor: toastProgressColor(type),
          transition: 'none',
        },
      }}
    />
  );
};

// ─── Toast item ───────────────────────────────────────────────────────────────

/**
 * Single toast rendered as a filled MUI Alert with optional progress bar,
 * action button, and close button.
 */
const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { id, message, type, duration, action, showProgress, dismissing, createdAt } = toast;

  const hasAction = Boolean(action?.label);

  return (
    <Collapse
      in={!dismissing}
      timeout={280}
      unmountOnExit
      sx={{ width: '100%', pointerEvents: 'auto' }}
    >
      <Alert
        severity={toastTypeToSeverity(type)}
        role="status"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        variant="filled"
        sx={{
          width: '100%',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          borderRadius: 1.5,
          position: 'relative',
          overflow: 'hidden',
          pr: hasAction ? 1 : 5,
          alignItems: 'flex-start',
          '& .MuiAlert-message': { flex: 1 },
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: '-2px' }}>
            {hasAction && (
              <Button
                size="small"
                onClick={() => {
                  action!.onClick();
                  onDismiss(id);
                }}
                sx={{
                  color: 'inherit',
                  fontWeight: 700,
                  textTransform: 'none',
                  minWidth: 0,
                  px: 1,
                  opacity: 0.9,
                  '&:hover': { opacity: 1, background: 'rgba(255,255,255,0.15)' },
                }}
              >
                {action!.label}
              </Button>
            )}
            <IconButton
              size="small"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(id)}
              sx={{
                color: 'inherit',
                opacity: 0.8,
                '&:hover': { opacity: 1, background: 'rgba(255,255,255,0.15)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        {message}

        {showProgress && duration > 0 && (
          <ProgressBar createdAt={createdAt} duration={duration} type={type} />
        )}
      </Alert>
    </Collapse>
  );
};

export default Toast;
