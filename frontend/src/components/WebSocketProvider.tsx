import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { TransactionMonitor } from '@chenaikit/core';
import { 
  TransactionEvent, 
  TransactionAnalysis, 
  Alert, 
  ConnectionStatus,
  MonitoringConfig 
} from '@chenaikit/core';

interface WebSocketContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (data: any) => void;
  monitor: TransactionMonitor | null;
  recentTransactions: TransactionEvent[];
  recentAlerts: Alert[];
  metrics: any;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  onTransaction?: (transaction: TransactionEvent, analysis: TransactionAnalysis) => void;
  onAlert?: (alert: Alert) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = 'ws://localhost:8080',
  reconnectInterval = 5000,
  maxReconnectAttempts = 10,
  autoConnect = true,
  onTransaction,
  onAlert,
  onConnectionChange,
  onError
}) => {
  const [state, setState] = useState({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastError: undefined as string | undefined,
    lastConnected: undefined as Date | undefined
  });

  const [recentTransactions, setRecentTransactions] = useState<TransactionEvent[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState({});

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
      setRecentTransactions(prev => [transaction, ...prev.slice(0, 49)]);
      onTransaction?.(transaction, analysis);
    });

    monitor.on('alert', (alert: Alert) => {
      setRecentAlerts(prev => [alert, ...prev.slice(0, 19)]);
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

  const value: WebSocketContextType = {
    ...state,
    connect,
    disconnect,
    send,
    monitor: monitorRef.current,
    recentTransactions,
    recentAlerts,
    metrics
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

/**
 * Hook for managing connection status with exponential backoff
 */
export const useWebSocketWithBackoff = (options: Partial<WebSocketProviderProps> = {}) => {
  const [backoffDelay, setBackoffDelay] = useState(1000);
  const ws = useWebSocket();

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

export default WebSocketProvider;
