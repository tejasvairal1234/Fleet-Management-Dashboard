// context/FleetContext.jsx
import { createContext, useReducer, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export const FleetContext = createContext(null);

const MAX_TREND_POINTS = 720; // 1h at 5s intervals

function robotsReducer(state, action) {
  switch (action.type) {
    case "SNAPSHOT": {
      const map = new Map();
      for (const r of action.robots) map.set(r.robot_id, r);
      return map;
    }
    case "ROBOT_UPDATE": {
      const next = new Map(state);
      next.set(action.robot.robot_id, action.robot);
      return next;
    }
    default:
      return state;
  }
}

function trendReducer(state, action) {
  switch (action.type) {
    case "ADD_POINT": {
      const next = [...state, action.point];
      return next.length > MAX_TREND_POINTS ? next.slice(-MAX_TREND_POINTS) : next;
    }
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

function uiReducer(state, patch) {
  return { ...state, ...patch };
}

const INITIAL_UI = {
  selectedRobotId:  null,
  focusedRobotId:   null,
  focusTimestamp:   0,
  searchTerm:       "",
  filter:           "all",
  connectionStatus: "reconnecting",
  lastUpdateTime:   null,
  showAdminPanel:   false,
  chartWindow:      "5m",
  showChart:        true,
};

export function FleetProvider({ children }) {
  const [robotsMap, dispatchRobots] = useReducer(robotsReducer, new Map());
  const [trendData, dispatchTrend]  = useReducer(trendReducer, []);
  const [uiState, dispatchUi]       = useReducer(uiReducer, INITIAL_UI);
  const lastUpdateRef = useRef(null);
  const robotsMapRef  = useRef(robotsMap);
  robotsMapRef.current = robotsMap;

  const handleSnapshot = useCallback((robots) => {
    dispatchRobots({ type: "SNAPSHOT", robots });
    lastUpdateRef.current = Date.now();
    dispatchUi({ lastUpdateTime: Date.now() });

    // If currently selected robot is not present in new snapshot, clear selection
    const robotIds = new Set(robots.map((r) => r.robot_id));
    if (uiState.selectedRobotId && !robotIds.has(uiState.selectedRobotId)) {
      dispatchUi({ selectedRobotId: null, focusedRobotId: null });
    }
  }, [uiState.selectedRobotId]);

  const handleRobotUpdate = useCallback((robot) => {
    dispatchRobots({ type: "ROBOT_UPDATE", robot });
    lastUpdateRef.current = Date.now();
    dispatchUi({ lastUpdateTime: Date.now() });
  }, []);

  const handleStatusChange = useCallback((status) => {
    dispatchUi({ connectionStatus: status });
  }, []);

  useWebSocket(handleSnapshot, handleRobotUpdate, handleStatusChange);

  // Trend data: sample working % every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const robots = Array.from(robotsMapRef.current.values());
      if (robots.length === 0) return;
      const working = robots.filter(
        (r) => r.status === "active" || r.status === "on_mission"
      ).length;
      const pct = parseFloat(((working / robots.length) * 100).toFixed(2));
      dispatchTrend({
        type: "ADD_POINT",
        point: {
          time:  Date.now(),
          value: pct,
          label: new Date().toLocaleTimeString(),
        },
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const robots = Array.from(robotsMap.values());

  const value = {
    robots,
    robotsMap,
    trendData,
    ...uiState,
    dispatchUi,
    setSelectedRobot: (id) => {
      dispatchUi({
        selectedRobotId: id,
        ...(id !== uiState.selectedRobotId ? { focusedRobotId: null } : {}),
      });
    },
    focusRobot: (id) => {
      dispatchUi({
        selectedRobotId: id,
        focusedRobotId: id,
        focusTimestamp: Date.now(),
      });
    },
    clearFocus:       ()       => dispatchUi({ focusedRobotId: null }),
    setSearch:        (term)   => dispatchUi({ searchTerm: term }),
    setFilter:        (filter) => dispatchUi({ filter }),
    setChartWindow:   (w)      => dispatchUi({ chartWindow: w }),
    toggleChart:      ()       => dispatchUi({ showChart: !uiState.showChart }),
    openAdminPanel:   ()       => dispatchUi({ showAdminPanel: true }),
    closeAdminPanel:  ()       => dispatchUi({ showAdminPanel: false }),
    lastUpdateRef,
  };

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}
