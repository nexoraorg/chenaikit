import React, { useEffect, useState, useCallback } from "react";
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  Slide,
  SlideProps,
} from "@mui/material";
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { useWebSocket } from "./WebSocketProvider";

interface NotificationData {
  id: string;
  type: "transaction" | "alert" | "creditScore" | "fraud" | "info";
  title: string;
  message: string;
  severity: "success" | "warning" | "error" | "info";
  timestamp: number;
}

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

export const RealTimeNotification: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [currentNotification, setCurrentNotification] =
    useState<NotificationData | null>(null);
  const { subscribe, isPaused } = useWebSocket();

  // Process notification queue
  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      setCurrentNotification(notifications[0]);
      setNotifications((prev) => prev.slice(1));
    }
  }, [notifications, currentNotification]);

  // Add notification to queue
  const addNotification = useCallback(
    (notification: NotificationData) => {
      if (isPaused) return;

      setNotifications((prev) => [...prev, notification]);
    },
    [isPaused],
  );

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Subscribe to transaction events
    unsubscribers.push(
      subscribe("transaction", (data) => {
        addNotification({
          id: `tx-${Date.now()}`,
          type: "transaction",
          title: "New Transaction",
          message: `Transaction processed: ${data.hash?.substring(0, 10)}...`,
          severity: "info",
          timestamp: Date.now(),
        });
      }),
    );

    // Subscribe to alert events
    unsubscribers.push(
      subscribe("alert", (data) => {
        addNotification({
          id: `alert-${Date.now()}`,
          type: "alert",
          title: data.severity === "high" ? "Critical Alert" : "Alert",
          message: data.message || "System alert triggered",
          severity: data.severity === "high" ? "error" : "warning",
          timestamp: Date.now(),
        });
      }),
    );

    // Subscribe to credit score updates
    unsubscribers.push(
      subscribe("creditScoreUpdate", (data) => {
        const change = data.currentScore - data.previousScore;
        addNotification({
          id: `credit-${Date.now()}`,
          type: "creditScore",
          title: "Credit Score Updated",
          message: `Your score ${change > 0 ? "increased" : "decreased"} by ${Math.abs(change)} points`,
          severity: change > 0 ? "success" : "warning",
          timestamp: Date.now(),
        });
      }),
    );

    // Subscribe to fraud alerts
    unsubscribers.push(
      subscribe("fraudAlert", (data) => {
        addNotification({
          id: `fraud-${Date.now()}`,
          type: "fraud",
          title: "Fraud Detection Alert",
          message: data.message || "Suspicious activity detected",
          severity: "error",
          timestamp: Date.now(),
        });
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [subscribe, addNotification]);

  const handleClose = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const getIcon = (type: NotificationData["type"]) => {
    switch (type) {
      case "transaction":
        return <TrendingUpIcon />;
      case "alert":
      case "fraud":
        return <WarningIcon />;
      default:
        return <InfoIcon />;
    }
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <Snackbar
      open={Boolean(currentNotification)}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      TransitionComponent={SlideTransition}
      sx={{ mt: 8 }}
    >
      <Alert
        severity={currentNotification.severity}
        icon={getIcon(currentNotification.type)}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          minWidth: 300,
          boxShadow: 3,
        }}
      >
        <AlertTitle sx={{ fontWeight: 600 }}>
          {currentNotification.title}
        </AlertTitle>
        <Typography variant="body2">{currentNotification.message}</Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {new Date(currentNotification.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default RealTimeNotification;
