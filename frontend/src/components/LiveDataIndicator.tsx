import React, { useEffect, useState } from "react";
import { Box, Typography, Tooltip, Badge, Pulse } from "@mui/material";
import { Favorite as FavoriteIcon } from "@mui/icons-material";
import { useDataActivityIndicator } from "../hooks/useWebSocket";

interface LiveDataIndicatorProps {
  label?: string;
  size?: "small" | "medium" | "large";
  animated?: boolean;
}

export const LiveDataIndicator: React.FC<LiveDataIndicatorProps> = ({
  label = "Live",
  size = "medium",
  animated = true,
}) => {
  const { hasNewData, checkActivity } = useDataActivityIndicator();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const active = checkActivity();
      setIsActive(active);
    }, 500);

    return () => clearInterval(interval);
  }, [checkActivity]);

  const sizeConfig = {
    small: { fontSize: "0.75rem", iconSize: 12 },
    medium: { fontSize: "0.875rem", iconSize: 16 },
    large: { fontSize: "1rem", iconSize: 20 },
  };

  const config = sizeConfig[size];

  return (
    <Tooltip
      title={hasNewData ? "Receiving live updates" : "No recent updates"}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: isActive ? "error.lighter" : "grey.100",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FavoriteIcon
            sx={{
              fontSize: config.iconSize,
              color: isActive ? "error.main" : "grey.400",
              animation:
                animated && isActive
                  ? "heartbeat 1.5s ease-in-out infinite"
                  : "none",
            }}
          />
          {isActive && (
            <Box
              sx={{
                position: "absolute",
                width: config.iconSize + 4,
                height: config.iconSize + 4,
                borderRadius: "50%",
                border: "1px solid",
                borderColor: "error.main",
                animation: "pulse 2s ease-in-out infinite",
                opacity: 0.7,
              }}
            />
          )}
        </Box>

        <Typography
          sx={{
            fontSize: config.fontSize,
            fontWeight: 600,
            color: isActive ? "error.main" : "grey.600",
          }}
        >
          {label}
        </Typography>

        <style>{`
          @keyframes heartbeat {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.2);
            }
          }
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.3;
            }
          }
        `}</style>
      </Box>
    </Tooltip>
  );
};
