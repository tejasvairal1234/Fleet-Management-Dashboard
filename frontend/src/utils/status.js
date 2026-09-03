// utils/status.js
// Status definitions and helpers

export const VALID_STATUSES = [
  "idle", "active", "on_mission", "charging",
  "blocked", "error", "maintenance", "offline",
];

export const STATUS_COLORS = {
  idle:        "#94a3b8",
  active:      "#3b82f6",
  on_mission:  "#10b981",
  charging:    "#8b5cf6",
  blocked:     "#f59e0b",
  error:       "#ef4444",
  maintenance: "#eab308",
  offline:     "#475569",
};

export const STATUS_GLOW = {
  idle:        "rgba(148, 163, 184, 0.35)",
  active:      "rgba(59, 130, 246, 0.5)",
  on_mission:  "rgba(16, 185, 129, 0.5)",
  charging:    "rgba(139, 92, 246, 0.5)",
  blocked:     "rgba(245, 158, 11, 0.5)",
  error:       "rgba(239, 68, 68, 0.6)",
  maintenance: "rgba(234, 179, 8, 0.5)",
  offline:     "rgba(71, 85, 105, 0.3)",
};

export const STATUS_LABELS = {
  idle:        "Idle",
  active:      "Active",
  on_mission:  "On Mission",
  charging:    "Charging",
  blocked:     "Blocked",
  error:       "Error",
  maintenance: "Maintenance",
  offline:     "Offline",
};

/**
 * Determines if a robot needs attention.
 * ATTENTION = blocked OR error OR maintenance OR offline OR battery < 20%
 */
export function needsAttention(robot) {
  if (!robot) return false;
  return (
    robot.status === "blocked" ||
    robot.status === "error" ||
    robot.status === "maintenance" ||
    robot.status === "offline" ||
    robot.battery < 20
  );
}

/**
 * WORKING = active OR on_mission
 */
export function isWorking(robot) {
  return robot.status === "active" || robot.status === "on_mission";
}

/**
 * Compute KPI counts from robots array.
 */
export function computeKPIs(robots) {
  const total    = robots.length;
  let working    = 0;
  let idle       = 0;
  let charging   = 0;
  let attention  = 0;
  let offline    = 0;

  for (const r of robots) {
    if (isWorking(r))       working++;
    if (r.status === "idle") idle++;
    if (r.status === "charging") charging++;
    if (r.status === "offline")  offline++;
    if (needsAttention(r))  attention++;
  }

  return { total, working, idle, charging, attention, offline };
}

/**
 * Return appropriate filter function for sidebar filter tab.
 */
export function getFilterFn(filter) {
  switch (filter) {
    case "attention": return needsAttention;
    case "working":   return isWorking;
    case "idle":      return (r) => r.status === "idle";
    case "charging":  return (r) => r.status === "charging";
    case "offline":   return (r) => r.status === "offline";
    default:          return () => true;
  }
}
