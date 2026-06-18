import React, { useMemo } from "react";
import {
  Box,
  Chip,
  Tooltip,
  CircularProgress,
  Typography,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudOff as CloudOffIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useConnectionStatus } from "../hooks/useWebSocket";

interface ConnectionStatusBadgeProps {
  variant?: "compact" | "full";
  showDetails?: boolean;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  variant = "compact",
  showDetails = true,
}) => {
  const {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    error,
    lastConnected,
  } = useConnectionStatus();

  const status = useMemo(() => {
    if (isReconnecting) {
      return {
        label: `Reconnecting... (${reconnectAttempts})`,
        color: "warning" as const,
        icon: (
          <RefreshIcon
            sx={{
              animation: "spin 2s linear infinite",
              "@keyframes spin": {
                "0%": { transform: "rotate(0deg)" },
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
        ),
        severity: "Attempting to reconnect",
      };
    }

    if (isConnected) {
      return {
        label: "Connected",
        color: "success" as const,
        icon: <CheckCircleIcon />,
        severity: `Last connected: ${lastConnected?.toLocaleTimeString() || "now"}`,
      };
    }

    if (error) {
      return {
        label: "Connection Error",
        color: "error" as const,
        icon: <ErrorIcon />,
        severity: error,
      };
    }

    return {
      label: "Disconnected",
      color: "default" as const,
      icon: <CloudOffIcon />,
      severity: "Not connected to real-time updates",
    };
  }, [isConnected, isReconnecting, reconnectAttempts, error, lastConnected]);

  const tooltipText = showDetails
    ? `${status.label}\n${status.severity}`
    : status.label;

  if (variant === "compact") {
    return (
      <Tooltip title={tooltipText}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: `${status.color}.lighter`,
            cursor: "pointer",
          }}
        >
          {status.icon}
          {isReconnecting && (
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              {reconnectAttempts}
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText}>
      <Chip
        icon={status.icon}
        label={status.label}
        color={status.color}
        variant="outlined"
        size="small"
        sx={{
          fontWeight: 500,
          "& .MuiChip-icon": {
            animation: isReconnecting ? "spin 2s linear infinite" : "none",
          },
          "@keyframes spin": {
            "0%": { transform: "rotate(0deg)" },
            "100%": { transform: "rotate(360deg)" },
          },
        }}
      />
    </Tooltip>
  );
};
