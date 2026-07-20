import { useEffect, useRef } from 'react';
import { useWebSocket } from '../components/WebSocketProvider';
import { WebSocketNamespace } from '../types/websocket';

/**
 * Custom React Hook to listen for specific WebSocket events on a namespace
 * Automatically handles event registration and unregistration on unmount/re-render.
 */
export function useWebSocketEvent<T = any>(
  namespace: WebSocketNamespace | string,
  eventName: string,
  callback: (data: T) => void,
  deps: any[] = []
): void {
  const { subscribe } = useWebSocket();
  const callbackRef = useRef(callback);

  // Keep latest callback ref to avoid unnecessary resubscriptions
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = subscribe<T>(namespace, eventName, (data: T) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, eventName, subscribe, ...deps]);
}

export default useWebSocketEvent;
