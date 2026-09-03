// hooks/useWebSocket.js
import { useEffect, useRef, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000/ws";
const MAX_BACKOFF_MS = 30000;
const INITIAL_BACKOFF_MS = 2000;

/**
 * Manages a WebSocket connection with automatic exponential backoff reconnection.
 * @param {Function} onSnapshot - called with full robots array on initial connect
 * @param {Function} onRobotUpdate - called with a single updated robot object
 * @param {Function} onStatusChange - called with "connected" | "reconnecting" | "offline"
 */
export function useWebSocket(onSnapshot, onRobotUpdate, onStatusChange) {
  const wsRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Stable refs to avoid re-creating the connect function
  const onSnapshotRef     = useRef(onSnapshot);
  const onRobotUpdateRef  = useRef(onRobotUpdate);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => { onSnapshotRef.current    = onSnapshot; },    [onSnapshot]);
  useEffect(() => { onRobotUpdateRef.current = onRobotUpdate; }, [onRobotUpdate]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        backoffRef.current = INITIAL_BACKOFF_MS;
        onStatusChangeRef.current?.("connected");
      };

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "snapshot") {
            onSnapshotRef.current?.(msg.robots);
          } else if (msg.type === "robot_update") {
            onRobotUpdateRef.current?.(msg.robot);
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        onStatusChangeRef.current?.("reconnecting");
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        onStatusChangeRef.current?.("reconnecting");
        // onclose will fire next
      };
    } catch (e) {
      onStatusChangeRef.current?.("offline");
      scheduleReconnect();
    }
  }, []);

  function scheduleReconnect() {
    if (!mountedRef.current) return;
    const delay = backoffRef.current;
    backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    reconnectTimerRef.current = setTimeout(connect, delay);
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
