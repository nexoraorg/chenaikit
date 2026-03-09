import { useState, useEffect, useRef, useCallback } from 'react';
import { TransactionMonitor } from '@chenaikit/core';
import { 
  TransactionEvent, 
  TransactionAnalysis, 
  Alert, 
  ConnectionStatus,
  MonitoringConfig 
} from '@chenaikit/core';

export interface WebSocketState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
}

export interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  onTransaction?: (transaction: TransactionEvent, analysis: TransactionAnalysis) => void;
  onAlert?: (alert: Alert) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn extends WebSocketState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (data: any) => void;
  monitor: TransactionMonitor | null;
  recentTransactions: TransactionEvent[];
  recentAlerts: Alert[];
  metrics: any;
}

/**
 * Custom hook for managing WebSocket connection to transaction monitoring system
 */
export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    url = 'ws://localhost:8080',
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    autoConnect = true,
    onTransaction,
    onAlert,
    onConnectionChange,
    onError
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0
  });

  const [recentTransactions, setRecentTransactions] = useState<TransactionEvent[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<any>({});

  const monitorRef = useRef<TransactionMonitor | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize transaction monitor
  const initializeMonitor = useCallback(() => {
    const config: MonitoringConfig = {
      horizonUrl: url,
      network: 'testnet',
      reconnectInterval,
      maxReconnectAttempts
    };

    const monitor = new TransactionMonitor(config);

    // Set up event listeners
    monitor.on('connected', () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastConnected: new Date(),
        lastError: undefined
      }));
      onConnectionChange?.(monitor.getConnectionStatus());
    });

    monitor.on('transaction', (transaction: TransactionEvent, analysis: TransactionAnalysis) => {
      setRecentTransactions(prev => [transaction, ...prev.slice(0, 49)]); // Keep last 50
      onTransaction?.(transaction, analysis);
    });

    monitor.on('alert', (alert: Alert) => {
      setRecentAlerts(prev => [alert, ...prev.slice(0, 19)]); // Keep last 20
      onAlert?.(alert);
    });

    monitor.on('error', (error: Error) => {
      setState(prev => ({ ...prev, lastError: error.message }));
      onError?.(error);
    });

    monitorRef.current = monitor;
    return monitor;
  }, [url, reconnectInterval, maxReconnectAttempts, onTransaction, onAlert, onConnectionChange, onError]);

  // Connect to monitoring system
  const connect = useCallback(async () => {
    if (monitorRef.current) {
      return;
    }

    try {
      const monitor = initializeMonitor();
      await monitor.start();
      
      // Get initial metrics
      const dashboardData = await monitor.getDashboardData();
      setMetrics(dashboardData.overview.realTimeMetrics);
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Connection failed'
      }));
      throw error;
    }
  }, [initializeMonitor]);

  // Disconnect from monitoring system
  const disconnect = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (monitorRef.current) {
      await monitorRef.current.stop();
      monitorRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isReconnecting: false,
      reconnectAttempts: 0
    }));
  }, []);

  // Send data through WebSocket (for future WebSocket implementation)
  const send = useCallback((data: any) => {
    if (!state.isConnected || !monitorRef.current) {
      throw new Error('WebSocket is not connected');
    }
    
    // For now, this is a placeholder for future WebSocket implementation
    console.log('Sending data:', data);
  }, [state.isConnected]);

  // Update metrics periodically
  useEffect(() => {
    if (!state.isConnected || !monitorRef.current) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const dashboardData = await monitorRef.current!.getDashboardData();
        setMetrics(dashboardData.overview.realTimeMetrics);
      } catch (error) {
        console.error('Error updating metrics:', error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [state.isConnected]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect().catch(error => {
        console.error('Auto-connect failed:', error);
      });
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    send,
    monitor: monitorRef.current,
    recentTransactions,
    recentAlerts,
    metrics
  };
};

/**
 * Hook for managing connection status with exponential backoff
 */
export const useWebSocketWithBackoff = (options: UseWebSocketOptions = {}) => {
  const [backoffDelay, setBackoffDelay] = useState(1000);
  const ws = useWebSocket({
    ...options,
    onError: (error) => {
      // Exponential backoff for reconnection
      setBackoffDelay(prev => Math.min(prev * 2, 30000));
      options.onError?.(error);
    },
    onConnectionChange: (status) => {
      if (status.connected) {
        setBackoffDelay(1000); // Reset backoff on successful connection
      }
      options.onConnectionChange?.(status);
    }
  });

  const connectWithBackoff = useCallback(async () => {
    try {
      await ws.connect();
    } catch (error) {
      if (ws.reconnectAttempts < (options.maxReconnectAttempts || 10)) {
        setTimeout(() => {
          ws.connect();
        }, backoffDelay);
      }
    }
  }, [ws, backoffDelay, options.maxReconnectAttempts]);

  return {
    ...ws,
    connectWithBackoff,
    backoffDelay
  };
};

export default useWebSocket;
