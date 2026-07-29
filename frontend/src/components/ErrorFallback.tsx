import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  BugReport,
  ExpandLess,
  ExpandMore,
  Refresh,
  RestartAlt,
} from '@mui/icons-material';
import { ErrorReport, ErrorType, getErrorCode } from '../utils/errorLogger';

export interface ErrorFallbackProps {
  error?: Error;
  errorType?: ErrorType;
  report?: ErrorReport;
  title?: string;
  message?: string;
  boundaryName?: string;
  onRetry?: () => void;
  onReset?: () => void;
  compact?: boolean;
}

function getFriendlyMessage(type: ErrorType): string {
  switch (type) {
    case 'network':
      return 'We could not reach the service. Check your connection and try again.';
    case 'authentication':
      return 'Your session could not be verified. Sign in again if the problem continues.';
    case 'validation':
      return 'Some information needs attention. Review the form and try again.';
    case 'websocket':
      return 'The live connection was interrupted. Reconnect or refresh this section.';
    case 'rendering':
      return 'This section ran into a rendering problem. Your data is still safe.';
    default:
      return 'Something went wrong. You can retry or reload the page.';
  }
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorType,
  report,
  title,
  message,
  boundaryName = 'Application',
  onRetry,
  onReset,
  compact = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const type = report?.type ?? errorType ?? 'unknown';
  const code = report?.code ?? getErrorCode(type);
  const errorMessage = message ?? getFriendlyMessage(type);
  const detail = report?.stack ?? error?.stack ?? error?.message;

  return (
    <Box
      component="section"
      role="alert"
      aria-live="assertive"
      sx={{
        minHeight: compact ? 'auto' : '45vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: compact ? 2 : { xs: 2, md: 4 },
      }}
    >
      <Paper
        elevation={compact ? 0 : 3}
        sx={{
          width: '100%',
          maxWidth: compact ? '100%' : 720,
          p: compact ? 2 : { xs: 2.5, md: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack spacing={2.5}>
          <Alert severity="error" icon={<BugReport />}>
            <Typography variant={compact ? 'subtitle1' : 'h6'} component="h2" sx={{ fontWeight: 700 }}>
              {title ?? `${boundaryName} needs attention`}
            </Typography>
            <Typography variant="body2">{errorMessage}</Typography>
          </Alert>

          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Error reference: <strong>{code}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Need help? Contact support at <strong>support@chenaikit.com</strong> and include this reference.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {onRetry && (
              <Button variant="contained" startIcon={<Refresh />} onClick={onRetry}>
                Retry
              </Button>
            )}
            {onReset && (
              <Button variant="outlined" startIcon={<RestartAlt />} onClick={onReset}>
                Reset section
              </Button>
            )}
            <Button
              variant="text"
              onClick={() => setShowDetails((current) => !current)}
              endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
            >
              Error details
            </Button>
          </Stack>

          <Collapse in={showDetails}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                overflow: 'auto',
                maxHeight: 260,
                borderRadius: 2,
                bgcolor: 'grey.100',
                color: 'text.primary',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {detail || 'No stack trace available.'}
            </Box>
          </Collapse>
        </Stack>
      </Paper>
    </Box>
  );
};

export default ErrorFallback;
