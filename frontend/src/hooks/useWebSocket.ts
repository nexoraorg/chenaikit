import { useState, useEffect, useCallback, useRef } from "react";

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface WebSocketOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastConnected?: Date;
}

export interface UseWebSocketReturn extends WebSocketState {
  send: (data: any) => void;
  connect: () => void;
  disconnect: () => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
}

/**
 * Custom hook for managing WebSocket connections with auto-reconnection
 * and exponential backoff
 */
export const useWebSocket = (options: WebSocketOptions): UseWebSocketReturn => {
  const {
    url,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    autoConnect = true,
    onOpen,
    onClose,
    onMessage,
    onError,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastError: undefined,
    lastConnected: undefined,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(
    new Map(),
  );
  const shouldReconnectRef = useRef<boolean>(true);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(
    (attempt: number): number => {
      const baseDelay = reconnectInterval;
      const maxDelay = 30000; // 30 seconds max
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      // Add jitter to prevent thundering herd
      return delay + Math.random() * 1000;
    },
    [reconnectInterval],
  );

  // Clean up connection
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }
  }, []);

  // Handle reconnection logic
  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) {
      return;
    }

    setState((prev) => {
      const nextAttempt = prev.reconnectAttempts + 1;

      if (nextAttempt > maxReconnectAttempts) {
        return {
          ...prev,
          isReconnecting: false,
          lastError: "Max reconnection attempts reached",
        };
      }

      const delay = getReconnectDelay(nextAttempt);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);

      return {
        ...prev,
        isReconnecting: true,
        reconnectAttempts: nextAttempt,
      };
    });
  }, [maxReconnectAttempts, getReconnectDelay]);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    cleanup();

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      lastError: undefined,
    }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState({
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          reconnectAttempts: 0,
          lastConnected: new Date(),
          lastError: undefined,
        });

        onOpen?.();
      };

      ws.onclose = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        onClose?.();

        if (shouldReconnectRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          lastError: "WebSocket connection error",
        }));

        onError?.(error);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Call global onMessage handler
          onMessage?.(message);

          // Call type-specific subscribers
          const subscribers = subscribersRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach((callback) => {
              try {
                callback(message.data);
              } catch (error) {
                console.error(
                  `Error in subscriber for ${message.type}:`,
                  error,
                );
              }
            });
          }

          // Call wildcard subscribers
          const wildcardSubscribers = subscribersRef.current.get("*");
          if (wildcardSubscribers) {
            wildcardSubscribers.forEach((callback) => {
              try {
                callback(message);
              } catch (error) {
                console.error("Error in wildcard subscriber:", error);
              }
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        lastError: error instanceof Error ? error.message : "Failed to connect",
      }));
    }
  }, [url, onOpen, onClose, onMessage, onError, cleanup, scheduleReconnect]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempts: 0,
    }));
  }, [cleanup]);

  // Send message through WebSocket
  const send = useCallback((data: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not connected. Message not sent.");
      return;
    }

    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
    }
  }, []);

  // Subscribe to specific event types
  const subscribe = useCallback(
    (eventType: string, callback: (data: any) => void) => {
      if (!subscribersRef.current.has(eventType)) {
        subscribersRef.current.set(eventType, new Set());
      }

      subscribersRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        const subscribers = subscribersRef.current.get(eventType);
        if (subscribers) {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            subscribersRef.current.delete(eventType);
          }
        }
      };
    },
    [],
  );

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      shouldReconnectRef.current = true;
      connect();
    }

    return () => {
      shouldReconnectRef.current = false;
      cleanup();
    };
  }, [autoConnect, connect, cleanup]);

  return {
    ...state,
    send,
    connect,
    disconnect,
    subscribe,
  };
};

export default useWebSocket;
