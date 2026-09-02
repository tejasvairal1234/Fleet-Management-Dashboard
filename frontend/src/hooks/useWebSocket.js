import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3000/ws`;
const INITIAL_BACKOFF_MS = 200;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

/**
 * useWebSocket — manages WebSocket connection with exponential backoff reconnection.
 *
 * Returns { robots: Map<id, state>, connectionStatus: 'live'|'reconnecting'|'disconnected' }
 * and an applyUpdate callback for external state management.
 */
export function useWebSocket(onSnapshot, onUpdate) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('reconnecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        console.log('[WS] Connected');
        backoffRef.current = INITIAL_BACKOFF_MS;
        setConnectionStatus('live');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot') {
            onSnapshot(msg.robots);
          } else if (msg.type === 'update') {
            onUpdate(msg.robot);
          }
          // 'config' messages are ignored on the main dashboard
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        console.log(`[WS] Closed — reconnecting in ${backoffRef.current}ms`);
        setConnectionStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
          connect();
        }, backoffRef.current);
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      setConnectionStatus('disconnected');
    }
  }, [onSnapshot, onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connectionStatus };
}
