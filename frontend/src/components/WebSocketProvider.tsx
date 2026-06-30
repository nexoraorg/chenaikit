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
import { io, Socket } from "socket.io-client";

// Types for WebSocket context
export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface RealtimeTransaction {
  id: string;
  hash: string;
  sourceAccount: string;
  amount: string;
  timestamp: string;
  type: "transaction_update";
}

export interface RealtimeAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

export interface RealtimeMetrics {
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
  successRate: number;
  timestamp: string;
}

export interface RealtimeCreditScore {
  userId: string;
  newScore: number;
  previousScore: number;
  change: number;
  timestamp: string;
}

export interface WebSocketContextType {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;

  // Data streams
  recentTransactions: RealtimeTransaction[];
  recentAlerts: RealtimeAlert[];
  metrics: RealtimeMetrics | null;
  creditScoreUpdates: RealtimeCreditScore[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  pauseUpdates: () => void;
  resumeUpdates: () => void;
  isPaused: boolean;

  // Event handlers
  onTransaction: (callback: (tx: RealtimeTransaction) => void) => () => void;
  onAlert: (callback: (alert: RealtimeAlert) => void) => () => void;
  onMetrics: (callback: (metrics: RealtimeMetrics) => void) => () => void;
  onCreditScoreUpdate: (
    callback: (cs: RealtimeCreditScore) => void,
  ) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  autoConnect?: boolean;
  userId?: string;
  token?: string;
  reconnectDelay?: number;
  reconnectDelayMax?: number;
  reconnectAttempts?: number;
}

const DEFAULT_CONFIG = {
  url: process.env.REACT_APP_WS_URL || "ws://localhost:5000",
  reconnectDelay: 1000,
  reconnectDelayMax: 5000,
  reconnectAttempts: 99,
  maxTransactionHistory: 50,
  maxAlertHistory: 20,
  maxCreditScoreHistory: 10,
};

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = DEFAULT_CONFIG.url,
  autoConnect = true,
  userId,
  token,
  reconnectDelay = DEFAULT_CONFIG.reconnectDelay,
  reconnectDelayMax = DEFAULT_CONFIG.reconnectDelayMax,
  reconnectAttempts = DEFAULT_CONFIG.reconnectAttempts,
}) => {
  const { t } = useTranslation();

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
  });

  // Data state
  const [recentTransactions, setRecentTransactions] = useState<
    RealtimeTransaction[]
  >([]);
  const [recentAlerts, setRecentAlerts] = useState<RealtimeAlert[]>([]);
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [creditScoreUpdates, setCreditScoreUpdates] = useState<
    RealtimeCreditScore[]
  >([]);
  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transactionCallbacksRef = useRef<
    Set<(tx: RealtimeTransaction) => void>
  >(new Set());
  const alertCallbacksRef = useRef<Set<(alert: RealtimeAlert) => void>>(
    new Set(),
  );
  const metricsCallbacksRef = useRef<Set<(metrics: RealtimeMetrics) => void>>(
    new Set(),
  );
  const creditScoreCallbacksRef = useRef<
    Set<(cs: RealtimeCreditScore) => void>
  >(new Set());
  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(url, {
      auth: {
        token: token || undefined,
        userId: userId || "anonymous",
      },
      reconnection: true,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      transports: ["websocket", "polling"],
    });

    // Connection handlers
    socket.on("connect", () => {
      console.log("✅ WebSocket connected");
      setConnectionStatus((prev) => ({
        ...prev,
        connected: true,
        reconnecting: false,
        lastConnected: new Date(),
        reconnectAttempts: 0,
        error: undefined,
      }));

      // Resubscribe on reconnect
      if (subscriptionsRef.current.size > 0) {
        socket.emit("subscribe", {
          channels: Array.from(subscriptionsRef.current),
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ WebSocket disconnected");
      setConnectionStatus((prev) => ({
        ...prev,
        connected: false,
      }));
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setConnectionStatus((prev) => ({
        ...prev,
        error: error.message,
        reconnecting: true,
      }));
    });

    socket.on("reconnect_attempt", () => {
      setConnectionStatus((prev) => ({
        ...prev,
        reconnecting: true,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
    });

    // Real-time data handlers
    socket.on("transaction:update", (data: any) => {
      if (!isPaused) {
        const transaction: RealtimeTransaction = {
          id: data.transaction.id,
          hash: data.transaction.hash,
          sourceAccount: data.transaction.sourceAccount,
          amount: data.transaction.operations?.[0]?.amount || "0",
          timestamp: data.timestamp,
          type: "transaction_update",
        };

        setRecentTransactions((prev) =>
          [transaction, ...prev].slice(0, DEFAULT_CONFIG.maxTransactionHistory),
        );

        // Call registered callbacks
        transactionCallbacksRef.current.forEach((cb) => cb(transaction));
      }
    });

    socket.on("alert:new", (data: any) => {
      if (!isPaused) {
        const alert: RealtimeAlert = {
          id: data.alert.id,
          type: data.alert.type,
          severity: data.alert.severity,
          title: data.alert.title,
          message: data.alert.message,
          timestamp: data.timestamp,
          data: data.alert.data,
        };

        setRecentAlerts((prev) =>
          [alert, ...prev].slice(0, DEFAULT_CONFIG.maxAlertHistory),
        );

        // Call registered callbacks
        alertCallbacksRef.current.forEach((cb) => cb(alert));
      }
    });

    socket.on("metrics:update", (data: any) => {
      if (!isPaused) {
        setMetrics(data.metrics);
        metricsCallbacksRef.current.forEach((cb) => cb(data.metrics));
      }
    });

    socket.on("credit-score:update", (data: any) => {
      if (!isPaused) {
        const update: RealtimeCreditScore = {
          userId: data.userId,
          newScore: data.newScore,
          previousScore: data.previousScore,
          change: data.change,
          timestamp: data.timestamp,
        };

        setCreditScoreUpdates((prev) =>
          [update, ...prev].slice(0, DEFAULT_CONFIG.maxCreditScoreHistory),
        );

        // Call registered callbacks
        creditScoreCallbacksRef.current.forEach((cb) => cb(update));
      }
    });

    socket.on("fraud:detected", (data: any) => {
      if (!isPaused) {
        const alert: RealtimeAlert = {
          id: data.alert.id,
          type: "fraud_detected",
          severity: "critical",
          title: "Fraud Alert",
          message: data.alert.message,
          timestamp: data.timestamp,
          data: data.alert,
        };

        setRecentAlerts((prev) =>
          [alert, ...prev].slice(0, DEFAULT_CONFIG.maxAlertHistory),
        );
        alertCallbacksRef.current.forEach((cb) => cb(alert));
      }
    });

    socketRef.current = socket;
  }, [
    url,
    token,
    userId,
    reconnectDelay,
    reconnectDelayMax,
    reconnectAttempts,
    isPaused,
  ]);

  // Disconnect handler
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionStatus({
        connected: false,
        reconnecting: false,
        reconnectAttempts: 0,
      });
    }
  }, []);

  // Subscribe to channels
  const subscribe = useCallback((channels: string[]) => {
    channels.forEach((ch) => subscriptionsRef.current.add(ch));

    if (socketRef.current?.connected) {
      socketRef.current.emit("subscribe", { channels });
    }
  }, []);

  // Unsubscribe from channels
  const unsubscribe = useCallback((channels: string[]) => {
    channels.forEach((ch) => subscriptionsRef.current.delete(ch));

    if (socketRef.current?.connected) {
      socketRef.current.emit("unsubscribe", { channels });
    }
  }, []);

  // Pause/resume updates
  const pauseUpdates = useCallback(() => setIsPaused(true), []);
  const resumeUpdates = useCallback(() => setIsPaused(false), []);

  // Event subscription hooks
  const onTransaction = useCallback(
    (callback: (tx: RealtimeTransaction) => void) => {
      transactionCallbacksRef.current.add(callback);
      return () => transactionCallbacksRef.current.delete(callback);
    },
    [],
  );

  const onAlert = useCallback((callback: (alert: RealtimeAlert) => void) => {
    alertCallbacksRef.current.add(callback);
    return () => alertCallbacksRef.current.delete(callback);
  }, []);

  const onMetrics = useCallback(
    (callback: (metrics: RealtimeMetrics) => void) => {
      metricsCallbacksRef.current.add(callback);
      return () => metricsCallbacksRef.current.delete(callback);
    },
    [],
  );

  const onCreditScoreUpdate = useCallback(
    (callback: (cs: RealtimeCreditScore) => void) => {
      creditScoreCallbacksRef.current.add(callback);
      return () => creditScoreCallbacksRef.current.delete(callback);
    },
    [],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [autoConnect, connect, disconnect]);

  // Context value
  const value = useMemo<WebSocketContextType>(
    () => ({
      connectionStatus,
      isConnected: connectionStatus.connected,
      isReconnecting: connectionStatus.reconnecting,
      recentTransactions,
      recentAlerts,
      metrics,
      creditScoreUpdates,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
      pauseUpdates,
      resumeUpdates,
      isPaused,
      onTransaction,
      onAlert,
      onMetrics,
      onCreditScoreUpdate,
    }),
    [
      connectionStatus,
      recentTransactions,
      recentAlerts,
      metrics,
      creditScoreUpdates,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
      pauseUpdates,
      resumeUpdates,
      isPaused,
      onTransaction,
      onAlert,
      onMetrics,
      onCreditScoreUpdate,
    ],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
