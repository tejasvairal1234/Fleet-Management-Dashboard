// utils/format.js
// Formatting helpers

/**
 * Format seconds-ago for last heartbeat display.
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return "Never";
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5)   return "Just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m ago`;
}

/**
 * Format battery as percentage string.
 */
export function formatBattery(battery) {
  if (battery === null || battery === undefined) return "N/A";
  return `${battery.toFixed(1)}%`;
}

/**
 * Format coordinates to 1 decimal.
 */
export function formatCoords(x, y) {
  if (x === null || y === null) return "Unknown";
  return `${Number(x).toFixed(1)}, ${Number(y).toFixed(1)}`;
}

/**
 * Format robot type for display.
 */
export function formatRobotType(type) {
  if (!type) return "Unknown";
  return type.toUpperCase();
}

/**
 * Format percentage to 1 decimal.
 */
export function formatPercent(value, total) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}
