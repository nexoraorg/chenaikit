import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { TransactionMonitor } from "@chenaikit/core";
import {
  TransactionEvent,
  TransactionAnalysis,
  Alert,
  ConnectionStatus,
  MonitoringConfig,
} from "@chenaikit/core";
import {
  useWebSocket as useWSHook,
  WebSocketMessage,
} from "../hooks/useWebSocket";

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
  connect: () => void;
  disconnect: () => void;
  send: (data: any) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
  monitor: TransactionMonitor | null;
  recentTransactions: TransactionEvent[];
  recentAlerts: Alert[];
  metrics: any;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  onTransaction?: (
    transaction: TransactionEvent,
    analysis: TransactionAnalysis,
  ) => void;
  onAlert?: (alert: Alert) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = "ws://localhost:8080",
  reconnectInterval = 5000,
  maxReconnectAttempts = 10,
  autoConnect = true,
  onTransaction,
  onAlert,
  onConnectionChange,
  onError,
}) => {
  const { t } = useTranslation();

  const [recentTransactions, setRecentTransactions] = useState<
    TransactionEvent[]
  >([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState({});
  const [isPaused, setIsPaused] = useState(false);

  const monitorRef = useRef<TransactionMonitor | null>(null);
  const updateQueueRef = useRef<Array<() => void>>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce rapid updates to prevent excessive re-renders
  const debouncedUpdate = useCallback((updateFn: () => void) => {
    updateQueueRef.current.push(updateFn);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const updates = updateQueueRef.current;
      updateQueueRef.current = [];

      // Batch all updates together
      updates.forEach((fn) => fn());
    }, 100); // 100ms debounce
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (isPaused) {
        return;
      }

      switch (message.type) {
        case "transaction":
          debouncedUpdate(() => {
            const { transaction, analysis } = message.data;
            setRecentTransactions((prev) => [
              transaction,
              ...prev.slice(0, 49),
            ]);
            onTransaction?.(transaction, analysis);
          });
          break;

        case "alert":
          debouncedUpdate(() => {
            setRecentAlerts((prev) => [message.data, ...prev.slice(0, 19)]);
            onAlert?.(message.data);
          });
          break;

        case "metrics":
          debouncedUpdate(() => {
            setMetrics(message.data);
          });
          break;

        case "creditScoreUpdate":
          // Dispatch custom event for credit score updates
          window.dispatchEvent(
            new CustomEvent("creditScoreUpdate", { detail: message.data }),
          );
          break;

        case "fraudAlert":
          // Dispatch custom event for fraud alerts
          window.dispatchEvent(
            new CustomEvent("fraudAlert", { detail: message.data }),
          );
          break;

        case "performanceMetrics":
          // Dispatch custom event for performance metrics
          window.dispatchEvent(
            new CustomEvent("performanceMetrics", { detail: message.data }),
          );
          break;

        default:
          // Unknown message type - log for debugging
          console.debug("Unknown WebSocket message type:", message.type);
      }
    },
    [isPaused, onTransaction, onAlert, debouncedUpdate],
  );

  // Use the custom WebSocket hook for connection management
  const ws = useWSHook({
    url,
    reconnectInterval,
    maxReconnectAttempts,
    autoConnect,
    onOpen: () => {
      onConnectionChange?.(
        monitorRef.current?.getConnectionStatus() as ConnectionStatus,
      );
    },
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      onError?.(new Error("WebSocket connection error"));
    },
  });

  // Initialize transaction monitor
  const initializeMonitor = useCallback(() => {
    const config: MonitoringConfig = {
      horizonUrl: url,
      network: "testnet",
      reconnectInterval,
      maxReconnectAttempts,
    };

    const monitor = new TransactionMonitor(config);

    // Set up event listeners for the monitor
    monitor.on("connected", () => {
      onConnectionChange?.(monitor.getConnectionStatus());
    });

    monitor.on(
      "transaction",
      (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
        if (!isPaused) {
          setRecentTransactions((prev) => [transaction, ...prev.slice(0, 49)]);
          onTransaction?.(transaction, analysis);
        }
      },
    );

    monitor.on("alert", (alert: Alert) => {
      if (!isPaused) {
        setRecentAlerts((prev) => [alert, ...prev.slice(0, 19)]);
        onAlert?.(alert);
      }
    });

    monitor.on("error", (error: Error) => {
      onError?.(error);
    });

    monitorRef.current = monitor;
    return monitor;
  }, [
    url,
    reconnectInterval,
    maxReconnectAttempts,
    onTransaction,
    onAlert,
    onConnectionChange,
    onError,
    isPaused,
  ]);

  // Start monitor on mount
  useEffect(() => {
    if (autoConnect) {
      const monitor = initializeMonitor();
      monitor.start().catch((error) => {
        console.error("Failed to start transaction monitor:", error);
      });
    }

    return () => {
      if (monitorRef.current) {
        monitorRef.current.stop();
        monitorRef.current = null;
      }
    };
  }, [autoConnect, initializeMonitor]);

  // Update metrics periodically
  useEffect(() => {
    if (!ws.isConnected || !monitorRef.current || isPaused) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const dashboardData = await monitorRef.current!.getDashboardData();
        setMetrics(dashboardData.overview.realTimeMetrics);
      } catch (error) {
        console.error("Error updating metrics:", error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [ws.isConnected, isPaused]);

  // Pause real-time updates
  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Resume real-time updates
  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const value = useMemo<WebSocketContextType>(
    () => ({
      isConnected: ws.isConnected,
      isConnecting: ws.isConnecting,
      isReconnecting: ws.isReconnecting,
      reconnectAttempts: ws.reconnectAttempts,
      lastError: ws.lastError,
      lastConnected: ws.lastConnected,
      connect: ws.connect,
      disconnect: ws.disconnect,
      send: ws.send,
      subscribe: ws.subscribe,
      monitor: monitorRef.current,
      recentTransactions,
      recentAlerts,
      metrics,
      isPaused,
      pause,
      resume,
    }),
    [ws, recentTransactions, recentAlerts, metrics, isPaused, pause, resume],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

/**
 * Hook for managing connection status with exponential backoff
 */
export const useWebSocketWithBackoff = (
  options: Partial<WebSocketProviderProps> = {},
) => {
  const [backoffDelay, setBackoffDelay] = useState(1000);
  const ws = useWebSocket();

  const connectWithBackoff = useCallback(async () => {
    try {
      ws.connect();
      setBackoffDelay(1000); // Reset backoff on successful connection
    } catch (error) {
      if (ws.reconnectAttempts < (options.maxReconnectAttempts || 10)) {
        const newDelay = Math.min(backoffDelay * 2, 30000);
        setBackoffDelay(newDelay);
        setTimeout(() => {
          ws.connect();
        }, newDelay);
      }
    }
  }, [ws, backoffDelay, options.maxReconnectAttempts]);

  return {
    ...ws,
    connectWithBackoff,
    backoffDelay,
  };
};

export default WebSocketProvider;
