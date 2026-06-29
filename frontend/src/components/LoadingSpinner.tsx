import React from 'react';
import { CircularProgress, Box, LinearProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  variant?: 'circular' | 'linear';
  fullScreen?: boolean;
  message?: string;
  size?: number | string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  variant = 'circular',
  fullScreen = false,
  message,
  size = 40,
}) => {
  const statusMessage = message ?? 'Loading';

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusMessage}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={2}
      sx={fullScreen ? { height: '100vh', width: '100%' } : { width: '100%' }}
    >
      {variant === 'circular' ? (
        <CircularProgress size={size} aria-hidden="true" />
      ) : (
        <Box width="100%" maxWidth={400}>
          <LinearProgress aria-hidden="true" />
        </Box>
      )}
      {message && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};
