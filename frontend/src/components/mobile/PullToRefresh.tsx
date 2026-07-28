import React, { useCallback, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

export interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  /** Distance in px required to trigger refresh. Default 72. */
  threshold?: number;
  disabled?: boolean;
}

/**
 * Lightweight pull-to-refresh for mobile scroll containers.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 72,
  disabled = false,
}) => {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const finish = useCallback(() => {
    pulling.current = false;
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || refreshing) return;
      const scrollTop =
        (event.currentTarget as HTMLElement).scrollTop ?? window.scrollY;
      if (scrollTop > 0) return;
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    },
    [disabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!pulling.current || disabled || refreshing) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Rubber-band: dampen pull distance
      setPullDistance(Math.min(delta * 0.45, threshold * 1.4));
    },
    [disabled, refreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled) {
      finish();
      return;
    }
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        finish();
      }
      return;
    }
    finish();
  }, [disabled, finish, onRefresh, pullDistance, refreshing, threshold]);

  const indicatorVisible = pullDistance > 8 || refreshing;

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ position: 'relative', minHeight: '100%' }}
    >
      <Box
        aria-hidden={!indicatorVisible}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: pullDistance,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pb: 1,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 2,
          transition: refreshing ? undefined : 'height 0.15s ease-out',
        }}
      >
        {indicatorVisible && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            {refreshing ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon
                sx={{
                  fontSize: 20,
                  transform: `rotate(${Math.min(pullDistance / threshold, 1) * 180}deg)`,
                }}
              />
            )}
            <Typography variant="caption">
              {refreshing
                ? 'Refreshing…'
                : pullDistance >= threshold
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
            </Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ transform: pullDistance ? `translateY(${pullDistance}px)` : undefined }}>
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
