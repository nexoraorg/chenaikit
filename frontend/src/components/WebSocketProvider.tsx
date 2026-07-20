import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io as SocketIOClient, Socket } from 'socket.io-client';
import { 
  CreditScoreEvent, 
  FraudAlertEvent, 
  TransactionEventPayload, 
  SystemMetricsEvent,
  QueuedMessage,
  ConnectionStatusType,
  WebSocketNamespace
} from '../types/websocket';

export interface WebSocketContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
  status: ConnectionStatusType;
  connect: (token?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  send: (namespace: WebSocketNamespace | string, event: string, data: any) => void;
  subscribe: <T = any>(namespace: WebSocketNamespace | string, eventName: string, callback: (data: T) => void) => () => void;
  recentTransactions: TransactionEventPayload[];
  recentAlerts: FraudAlertEvent[];
  recentScoreUpdates: CreditScoreEvent[];
  metrics: SystemMetricsEvent | Record<string, any>;
  queuedCount: number;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  token?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  onTransaction?: (transaction: TransactionEventPayload) => void;
  onAlert?: (alert: FraudAlertEvent) => void;
  onScoreUpdate?: (score: CreditScoreEvent) => void;
  onConnectionChange?: (status: ConnectionStatusType) => void;
  onError?: (error: Error) => void;
}

const NAMESPACES: WebSocketNamespace[] = ['/alerts', '/scores', '/transactions'];

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = process.env.REACT_APP_WS_URL || 'http://localhost:5000',
  token,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  autoConnect = true,
  onTransaction,
  onAlert,
  onScoreUpdate,
  onConnectionChange,
  onError
}) => {
  const [status, setStatus] = useState<ConnectionStatusType>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | undefined>();
  const [lastConnected, setLastConnected] = useState<Date | undefined>();

  const [recentTransactions, setRecentTransactions] = useState<TransactionEventPayload[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<FraudAlertEvent[]>([]);
  const [recentScoreUpdates, setRecentScoreUpdates] = useState<CreditScoreEvent[]>([]);
  const [metrics, setMetrics] = useState<SystemMetricsEvent | Record<string, any>>({});
  const [queuedCount, setQueuedCount] = useState(0);

  const socketsRef = useRef<Map<string, Socket>>(new Map());
  const pendingQueueRef = useRef<QueuedMessage[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper for event deduplication
  const isDuplicateEvent = useCallback((eventId?: string, data?: any): boolean => {
    const id = eventId || (data?.id ? String(data.id) : `${data?.timestamp}-${JSON.stringify(data).slice(0, 30)}`);
    if (seenEventIdsRef.current.has(id)) {
      return true;
    }
    seenEventIdsRef.current.add(id);
    if (seenEventIdsRef.current.size > 200) {
      const firstKey = seenEventIdsRef.current.values().next().value;
      if (firstKey) seenEventIdsRef.current.delete(firstKey);
    }
    return false;
  }, []);

  // Flush queued messages upon successful connection
  const flushQueue = useCallback(() => {
    if (pendingQueueRef.current.length === 0) return;

    const queue = [...pendingQueueRef.current];
    pendingQueueRef.current = [];
    setQueuedCount(0);

    queue.forEach(item => {
      const socket = socketsRef.current.get(item.namespace);
      if (socket && socket.connected) {
        socket.emit(item.event, item.data);
      } else {
        // Re-queue if still unsendable
        pendingQueueRef.current.push(item);
      }
    });
    setQueuedCount(pendingQueueRef.current.length);
  }, []);

  // Connect to backend WebSocket server across all namespaces
  const connect = useCallback(async (authToken?: string) => {
    const jwtToken = authToken || token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null) || '';
    
    setStatus('connecting');

    NAMESPACES.forEach(ns => {
      if (socketsRef.current.has(ns)) {
        socketsRef.current.get(ns)?.disconnect();
      }

      const socket = SocketIOClient(`${url}${ns}`, {
        auth: { token: jwtToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectInterval,
        autoConnect: true
      });

      socket.on('connect', () => {
        setStatus('connected');
        setLastConnected(new Date());
        setLastError(undefined);
        setReconnectAttempts(0);
        onConnectionChange?.('connected');
        flushQueue();
      });

      socket.on('connect_error', (err: Error) => {
        setLastError(err.message);
        setStatus('error');
        onError?.(err);
      });

      socket.on('reconnect_attempt', (attempt: number) => {
        setStatus('reconnecting');
        setReconnectAttempts(attempt);
        onConnectionChange?.('reconnecting');
      });

      socket.on('disconnect', (reason: string) => {
        if (reason === 'io server disconnect') {
          // Severed by server, try manual reconnect
          socket.connect();
        }
        setStatus('disconnected');
        onConnectionChange?.('disconnected');
      });

      // Register Namespace Specific Real-Time Event Handlers
      if (ns === '/alerts') {
        socket.on('alert:new', (alert: FraudAlertEvent) => {
          if (isDuplicateEvent(alert.id, alert)) return;
          setRecentAlerts(prev => [alert, ...prev.slice(0, 19)]);
          onAlert?.(alert);
        });
      }

      if (ns === '/scores') {
        socket.on('score:updated', (score: CreditScoreEvent) => {
          if (isDuplicateEvent(undefined, score)) return;
          setRecentScoreUpdates(prev => [score, ...prev.slice(0, 19)]);
          onScoreUpdate?.(score);
        });
      }

      if (ns === '/transactions') {
        socket.on('transaction:new', (tx: TransactionEventPayload) => {
          if (isDuplicateEvent(tx.transactionId, tx)) return;
          setRecentTransactions(prev => [tx, ...prev.slice(0, 49)]);
          onTransaction?.(tx);
        });

        socket.on('metrics:update', (sysMetrics: SystemMetricsEvent) => {
          setMetrics(sysMetrics);
        });
      }

      socketsRef.current.set(ns, socket);
    });
  }, [url, token, maxReconnectAttempts, reconnectInterval, onConnectionChange, onError, onAlert, onScoreUpdate, onTransaction, isDuplicateEvent, flushQueue]);

  // Disconnect from all namespaces
  const disconnect = useCallback(async () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    socketsRef.current.forEach(socket => socket.disconnect());
    socketsRef.current.clear();
    setStatus('disconnected');
    setReconnectAttempts(0);
  }, []);

  // Send message / emit event with offline queueing resilience
  const send = useCallback((namespace: WebSocketNamespace | string, event: string, data: any) => {
    const socket = socketsRef.current.get(namespace);
    
    if (socket && socket.connected) {
      socket.emit(event, data);
    } else {
      // Offline queue resilience
      const message: QueuedMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        namespace,
        event,
        data,
        timestamp: Date.now()
      };
      pendingQueueRef.current.push(message);
      setQueuedCount(pendingQueueRef.current.length);
    }
  }, []);

  // Subscribe to specific event on a namespace
  const subscribe = useCallback(<T = any>(
    namespace: WebSocketNamespace | string,
    eventName: string,
    callback: (data: T) => void
  ): (() => void) => {
    const socket = socketsRef.current.get(namespace);
    if (socket) {
      const wrappedHandler = (data: T) => {
        if (!isDuplicateEvent(undefined, data)) {
          callback(data);
        }
      };
      socket.on(eventName, wrappedHandler);
      return () => {
        socket.off(eventName, wrappedHandler);
      };
    }
    return () => {};
  }, [isDuplicateEvent]);

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect().catch(err => {
        console.error('Auto-connect WebSocket failed:', err);
      });
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const value: WebSocketContextType = {
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    reconnectAttempts,
    lastError,
    lastConnected,
    status,
    connect,
    disconnect,
    send,
    subscribe,
    recentTransactions,
    recentAlerts,
    recentScoreUpdates,
    metrics,
    queuedCount
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
        setBackoffDelay(prev => Math.min(prev * 2, 30000));
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
