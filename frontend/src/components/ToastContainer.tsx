import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import ToastItem from './Toast';
import { useToastContext } from '../contexts/ToastContext';
import { stackAlignment } from '../utils/toastUtils';
import type { ToastPosition, Toast } from '../contexts/ToastContext';

// ─── Group toasts by position ─────────────────────────────────────────────────

function groupByPosition(toasts: Toast[]): Map<ToastPosition, Toast[]> {
  const map = new Map<ToastPosition, Toast[]>();
  for (const toast of toasts) {
    const pos = toast.position;
    if (!map.has(pos)) map.set(pos, []);
    map.get(pos)!.push(toast);
  }
  return map;
}

// ─── Single stack ─────────────────────────────────────────────────────────────

interface ToastStackProps {
  position: ToastPosition;
  toasts: Toast[];
  onDismiss: (id: string) => void;
  maxToasts: number;
}

const ToastStack: React.FC<ToastStackProps> = ({
  position,
  toasts,
  onDismiss,
  maxToasts,
}) => {
  const containerStyle = stackAlignment(position);
  const visible = toasts.slice(0, maxToasts);

  return (
    <Box
      component="section"
      aria-label="Notifications"
      sx={containerStyle}
    >
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </Box>
  );
};

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * Renders all active toasts, grouped by position, into a portal attached
 * to `document.body` so they always float above all other content.
 *
 * Place this once inside your app tree (already wired in App.tsx via
 * ToastProvider). It reads state directly from ToastContext, so no props
 * are needed.
 */
const ToastContainer: React.FC = () => {
  const { toasts, config, dismiss } = useToastContext();

  const grouped = useMemo(() => groupByPosition(toasts), [toasts]);

  if (toasts.length === 0) return null;

  return createPortal(
    <>
      {Array.from(grouped.entries()).map(([position, positionToasts]) => (
        <ToastStack
          key={position}
          position={position}
          toasts={positionToasts}
          onDismiss={dismiss}
          maxToasts={config.maxToasts}
        />
      ))}
    </>,
    document.body
  );
};

export default ToastContainer;
