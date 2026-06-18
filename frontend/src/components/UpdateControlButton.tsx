import React from "react";
import { IconButton, Tooltip, Badge } from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
} from "@mui/icons-material";
import { usePauseResumeUpdates } from "../hooks/useWebSocket";

interface UpdateControlButtonProps {
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

export const UpdateControlButton: React.FC<UpdateControlButtonProps> = ({
  size = "medium",
  showLabel = false,
}) => {
  const { isPaused, toggleUpdates } = usePauseResumeUpdates();

  return (
    <Tooltip
      title={isPaused ? "Resume real-time updates" : "Pause real-time updates"}
    >
      <IconButton
        onClick={toggleUpdates}
        size={size}
        sx={{
          transition: "all 0.3s ease",
          "&:hover": {
            bgcolor: isPaused ? "success.lighter" : "warning.lighter",
          },
        }}
      >
        <Badge
          badgeContent={isPaused ? "⏸" : "▶"}
          sx={{
            "& .MuiBadge-badge": {
              fontSize: "0.6rem",
              padding: "2px 4px",
            },
          }}
        >
          {isPaused ? (
            <PlayArrowIcon color="success" />
          ) : (
            <PauseIcon color="warning" />
          )}
        </Badge>
      </IconButton>
    </Tooltip>
  );
};
