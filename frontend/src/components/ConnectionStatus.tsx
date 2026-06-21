import React from "react";
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
} from "@mui/material";
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useWebSocket } from "./WebSocketProvider";

interface ConnectionStatusProps {
  showControls?: boolean;
  size?: "small" | "medium";
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showControls = true,
  size = "medium",
}) => {
  const {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    lastConnected,
    lastError,
    isPaused,
    pause,
    resume,
    connect,
  } = useWebSocket();

  const getStatusColor = ():
    | "success"
    | "warning"
    | "error"
    | "info"
    | "default" => {
    if (isPaused) return "default";
    if (isConnected) return "success";
    if (isConnecting || isReconnecting) return "info";
    return "error";
  };

  const getStatusLabel = (): string => {
    if (isPaused) return "Paused";
    if (isConnected) return "Connected";
    if (isConnecting) return "Connecting...";
    if (isReconnecting) return `Reconnecting (${reconnectAttempts})`;
    return "Disconnected";
  };

  const getStatusIcon = () => {
    if (isPaused) return <PauseIcon fontSize={size} />;
    if (isConnected) return <WifiIcon fontSize={size} />;
    if (isConnecting || isReconnecting)
      return <CircularProgress size={size === "small" ? 16 : 20} />;
    return <WifiOffIcon fontSize={size} />;
  };

  const getTooltipContent = (): string => {
    const parts: string[] = [];

    if (lastConnected) {
      parts.push(`Last connected: ${lastConnected.toLocaleTimeString()}`);
    }

    if (isReconnecting) {
      parts.push(`Reconnection attempt ${reconnectAttempts}`);
    }

    if (lastError) {
      parts.push(`Error: ${lastError}`);
    }

    if (parts.length === 0) {
      parts.push(getStatusLabel());
    }

    return parts.join("\n");
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Tooltip title={getTooltipContent()} arrow>
        <Badge
          variant="dot"
          color={getStatusColor()}
          overlap="circular"
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          sx={{
            "& .MuiBadge-badge": {
              animation:
                isConnecting || isReconnecting ? "pulse 2s infinite" : "none",
            },
            "@keyframes pulse": {
              "0%": {
                opacity: 1,
              },
              "50%": {
                opacity: 0.5,
              },
              "100%": {
                opacity: 1,
              },
            },
          }}
        >
          <Chip
            icon={getStatusIcon()}
            label={getStatusLabel()}
            color={getStatusColor()}
            size={size}
            variant={isPaused ? "outlined" : "filled"}
          />
        </Badge>
      </Tooltip>

      {showControls && (
        <>
          <Tooltip title={isPaused ? "Resume updates" : "Pause updates"}>
            <IconButton
              size={size}
              onClick={isPaused ? resume : pause}
              color={isPaused ? "default" : "primary"}
            >
              {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
            </IconButton>
          </Tooltip>

          {!isConnected && (
            <Tooltip title="Reconnect">
              <IconButton
                size={size}
                onClick={connect}
                disabled={isConnecting || isReconnecting}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
    </Box>
  );
};

export default ConnectionStatus;
