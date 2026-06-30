import { useEffect, useCallback, useState, useRef } from "react";
import { useWebSocket as useWebSocketContext } from "../components/WebSocketProvider";
import {
  RealtimeTransaction,
  RealtimeAlert,
  RealtimeMetrics,
  RealtimeCreditScore,
} from "../components/WebSocketProvider";

/**
 * Hook to subscribe to transactions with optional debouncing
 */
export function useTransactionUpdates(debounceMs: number = 500) {
  const ws = useWebSocketContext();
  const [latestTransaction, setLatestTransaction] =
    useState<RealtimeTransaction | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    ws.subscribe(["transactions"]);

    const unsubscribe = ws.onTransaction((tx) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setLatestTransaction(tx);
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      ws.unsubscribe(["transactions"]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ws, debounceMs]);

  return {
    latestTransaction,
    recentTransactions: ws.recentTransactions,
  };
}

/**
 * Hook to subscribe to alerts
 */
export function useAlertUpdates() {
  const ws = useWebSocketContext();
  const [highSeverityAlert, setHighSeverityAlert] =
    useState<RealtimeAlert | null>(null);

  useEffect(() => {
    ws.subscribe(["alerts", "fraud-alerts"]);

    const unsubscribe = ws.onAlert((alert) => {
      if (alert.severity === "critical" || alert.severity === "high") {
        setHighSeverityAlert(alert);
      }
    });

    return () => {
      unsubscribe();
      ws.unsubscribe(["alerts", "fraud-alerts"]);
    };
  }, [ws]);

  return {
    highSeverityAlert,
    recentAlerts: ws.recentAlerts,
  };
}

/**
 * Hook to subscribe to metrics updates with debouncing
 */
export function useMetricsUpdates(debounceMs: number = 1000) {
  const ws = useWebSocketContext();
  const [currentMetrics, setCurrentMetrics] = useState<RealtimeMetrics | null>(
    ws.metrics,
  );
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    ws.subscribe(["metrics"]);

    const unsubscribe = ws.onMetrics((metrics) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setCurrentMetrics(metrics);
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      ws.unsubscribe(["metrics"]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ws, debounceMs]);

  return currentMetrics;
}

/**
 * Hook to subscribe to credit score updates for a specific user
 */
export function useCreditScoreUpdates(userId: string) {
  const ws = useWebSocketContext();
  const [creditScore, setCreditScore] = useState<RealtimeCreditScore | null>(
    null,
  );

  useEffect(() => {
    const channel = `credit-score:${userId}`;
    ws.subscribe([channel]);

    const unsubscribe = ws.onCreditScoreUpdate((update) => {
      if (update.userId === userId) {
        setCreditScore(update);
      }
    });

    return () => {
      unsubscribe();
      ws.unsubscribe([channel]);
    };
  }, [ws, userId]);

  return creditScore;
}

/**
 * Hook to get connection status and indicators
 */
export function useConnectionStatus() {
  const ws = useWebSocketContext();

  return {
    isConnected: ws.isConnected,
    isReconnecting: ws.isReconnecting,
    reconnectAttempts: ws.connectionStatus.reconnectAttempts,
    error: ws.connectionStatus.error,
    lastConnected: ws.connectionStatus.lastConnected,
    connect: ws.connect,
    disconnect: ws.disconnect,
  };
}

/**
 * Hook to manage pause/resume of real-time updates
 */
export function usePauseResumeUpdates() {
  const ws = useWebSocketContext();

  return {
    isPaused: ws.isPaused,
    pauseUpdates: ws.pauseUpdates,
    resumeUpdates: ws.resumeUpdates,
    toggleUpdates: () => {
      if (ws.isPaused) {
        ws.resumeUpdates();
      } else {
        ws.pauseUpdates();
      }
    },
  };
}

/**
 * Hook to check if new data has arrived since last check
 */
export function useDataActivityIndicator() {
  const ws = useWebSocketContext();
  const [hasNewData, setHasNewData] = useState(false);
  const lastCheckedRef = useRef<number>(Date.now());

  const checkActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckedRef.current;
    const hasActivity =
      ws.recentTransactions.length > 0 ||
      ws.recentAlerts.length > 0 ||
      ws.metrics !== null ||
      ws.creditScoreUpdates.length > 0;

    lastCheckedRef.current = now;
    setHasNewData(hasActivity && timeSinceLastCheck < 5000); // Activity within last 5 seconds
    return hasActivity;
  }, [
    ws.recentTransactions,
    ws.recentAlerts,
    ws.metrics,
    ws.creditScoreUpdates,
  ]);

  return {
    hasNewData,
    checkActivity,
  };
}
