import React, { useEffect, useState } from "react";
import {
  Alert as MuiAlert,
  AlertTitle,
  Box,
  Stack,
  Collapse,
  IconButton,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useAlertUpdates } from "../hooks/useWebSocket";
import { RealtimeAlert } from "../components/WebSocketProvider";

interface NotificationToastProps {
  maxVisible?: number;
  autoCloseDuration?: number;
}

export const RealtimeNotificationToast: React.FC<NotificationToastProps> = ({
  maxVisible = 3,
  autoCloseDuration = 6000,
}) => {
  const { highSeverityAlert, recentAlerts } = useAlertUpdates();
  const [visibleNotifications, setVisibleNotifications] = useState<
    RealtimeAlert[]
  >([]);

  useEffect(() => {
    if (highSeverityAlert) {
      setVisibleNotifications((prev) => {
        const updated = [highSeverityAlert, ...prev];
        return updated.slice(0, maxVisible);
      });

      // Auto-close after duration
      const timer = setTimeout(() => {
        setVisibleNotifications((prev) =>
          prev.filter((n) => n.id !== highSeverityAlert.id),
        );
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [highSeverityAlert, maxVisible, autoCloseDuration]);

  const handleClose = (alertId: string) => {
    setVisibleNotifications((prev) => prev.filter((n) => n.id !== alertId));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "error";
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "info";
    }
  };

  return (
    <Stack
      spacing={1}
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1300,
        maxWidth: 400,
        pointerEvents: "auto",
      }}
    >
      {visibleNotifications.map((notification) => (
        <Collapse key={notification.id} in={true}>
          <MuiAlert
            severity={getSeverityColor(notification.severity) as any}
            variant="filled"
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() => handleClose(notification.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{
              width: 380,
              boxShadow: 2,
              animation: "slideIn 0.3s ease-in-out",
            }}
          >
            <AlertTitle sx={{ fontWeight: 600 }}>
              {notification.title}
            </AlertTitle>
            {notification.message}
            {notification.data && (
              <Box sx={{ mt: 1, fontSize: "0.85rem", opacity: 0.8 }}>
                {typeof notification.data === "string"
                  ? notification.data
                  : JSON.stringify(notification.data).substring(0, 100) + "..."}
              </Box>
            )}
          </MuiAlert>
        </Collapse>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </Stack>
  );
};
