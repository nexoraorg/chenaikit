import React, { useState } from "react";
import {
  Tooltip as MuiTooltip,
  tooltipClasses,
  IconButton,
  Box,
  styled,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

export interface TooltipProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  placement?:
    | "bottom"
    | "top"
    | "left"
    | "right"
    | "bottom-start"
    | "bottom-end"
    | "top-start"
    | "top-end";
  followCursor?: boolean;
  persistent?: boolean;
  icon?: React.ReactNode;
  className?: string;
  enterDelay?: number;
  leaveDelay?: number;
  arrow?: boolean;
}

const StyledTooltip = styled(MuiTooltip)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    fontSize: "0.92rem",
    maxWidth: 320,
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[2],
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.grey[900],
  },
}));

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = "top",
  followCursor = false,
  persistent = false,
  icon,
  className,
  enterDelay,
  leaveDelay,
  arrow = true,
}) => {
  const [open, setOpen] = useState(false);

  const trigger = (
    <Box component="span" className={className} sx={{ display: "inline-flex" }}>
      {children ?? icon ?? <HelpOutlineIcon fontSize="small" />}
    </Box>
  );

  return (
    <StyledTooltip
      title={title}
      placement={placement}
      followCursor={followCursor}
      disableTouchListener={!persistent}
      disableFocusListener={!persistent}
      enterDelay={enterDelay ?? (persistent ? 0 : 250)}
      leaveDelay={leaveDelay ?? (persistent ? 5000 : 100)}
      open={persistent ? open : undefined}
      onOpen={() => persistent && setOpen(true)}
      onClose={() => persistent && setOpen(false)}
      arrow={arrow}
    >
      {icon ? (
        <IconButton
          size="small"
          aria-label={typeof title === "string" ? title : "Tooltip"}
        >
          {icon}
        </IconButton>
      ) : (
        trigger
      )}
    </StyledTooltip>
  );
};

export default Tooltip;
