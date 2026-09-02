import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Resolves the WebSocket URL with secure production and local fallback:
 * 1. Primary: import.meta.env.VITE_WS_URL if explicitly set in the environment.
 * 2. Safe Fallback:
 *    - Enforces 'wss://' whenever the frontend is served over HTTPS to avoid Mixed Content errors.
 *    - Defaults to 'ws://' for local HTTP development (localhost:3000/ws).
 */
export function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  // Local development default (backend on port 3000)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000/ws`;
  }

  // Deployed production fallback with same-host / reverse-proxy
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
  return `${protocol}//${hostname}${port}/ws`;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

/**
 * useWebSocket — manages WebSocket connection with exponential backoff reconnection.
 *
 * Returns { connectionStatus: 'live'|'reconnecting'|'disconnected' }
 * Invokes onSnapshot and onUpdate callbacks when messages arrive.
 */
export function useWebSocket(onSnapshot, onUpdate) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Keep latest callback references without triggering socket re-creation
  const onSnapshotRef = useRef(onSnapshot);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onUpdateRef.current = onUpdate;
  });

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Avoid creating duplicate connections if socket is already connecting or open
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        setConnectionStatus('live');
        return;
      }
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    const wsUrl = getWebSocketUrl();
    setConnectionStatus('reconnecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close(1000, 'Unmounted');
          return;
        }
        console.log('[WS] Connected to', wsUrl);
        backoffRef.current = INITIAL_BACKOFF_MS;
        setConnectionStatus('live');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot') {
            onSnapshotRef.current?.(msg.robots);
          } else if (msg.type === 'update') {
            onUpdateRef.current?.(msg.robot);
          }
          // 'config' messages are handled where appropriate
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onerror = () => {
        // Minimal notice to prevent noisy console dump on initial probe/reconnect
        if (mountedRef.current) {
          console.warn(`[WS] Connection issue on ${wsUrl} — reconnect scheduled`);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        wsRef.current = null;

        // Code 1000 is intentional normal closure; don't trigger backoff spam if intended
        if (event.code !== 1000) {
          console.log(`[WS] Closed (code: ${event.code}) — reconnecting in ${backoffRef.current}ms`);
        }

        setConnectionStatus('reconnecting');
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
          connect();
        }, backoffRef.current);
      };
    } catch (err) {
      console.error('[WS] Failed to initialize WebSocket:', err.message);
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        const ws = wsRef.current;
        // Detach listeners so unmount does not trigger error or reconnect loops
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Component unmounted');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // Do not call ws.close() immediately while CONNECTING (which causes Firefox to report connection interrupted)
          // Instead, wait for the handshake to complete and then close cleanly with 1000
          ws.onopen = () => {
            try { ws.close(1000, 'Component unmounted'); } catch {}
          };
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connectionStatus };
}
