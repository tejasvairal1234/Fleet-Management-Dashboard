import { useState, useCallback, useRef, useMemo } from 'react';
import { needsAttention } from '../utils/statusColors';

/**
 * useFleetState — manages Map<robot_id, RobotState> as React state.
 *
 * Returns robots (Map), stats (counts), lastUpdateTime, and update handlers.
 */
export function useFleetState() {
  const robotMapRef = useRef(new Map());
  const [generation, setGeneration] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const bump = useCallback(() => {
    setGeneration(g => g + 1);
    setLastUpdate(Date.now());
  }, []);

  const applySnapshot = useCallback((robotsArray) => {
    const map = new Map();
    if (Array.isArray(robotsArray)) {
      for (const r of robotsArray) {
        map.set(r.robot_id, r);
      }
    }
    robotMapRef.current = map;
    bump();
  }, [bump]);

  const applyUpdate = useCallback((robot) => {
    if (!robot?.robot_id) return;
    robotMapRef.current.set(robot.robot_id, robot);
    bump();
  }, [bump]);

  // Compute stats from current map
  const stats = useMemo(() => {
    const robots = Array.from(robotMapRef.current.values());
    const total = robots.length;
    let working = 0, idle = 0, charging = 0, offline = 0, attention = 0;

    for (const r of robots) {
      if (r.status === 'active' || r.status === 'on_mission') working++;
      else if (r.status === 'idle') idle++;
      else if (r.status === 'charging') charging++;
      else if (r.status === 'offline') offline++;
      if (needsAttention(r)) attention++;
    }

    return { total, working, idle, charging, offline, attention };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  return {
    robots: robotMapRef.current,
    generation,
    stats,
    lastUpdate,
    applySnapshot,
    applyUpdate,
  };
}
