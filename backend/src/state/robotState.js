'use strict';
const config = require('../config');

/**
 * In-memory current state of the entire fleet.
 * Map<robot_id: string, RobotState>
 *
 * RobotState shape:
 * {
 *   robot_id: string,
 *   robot_type: string,
 *   x: number,
 *   y: number,
 *   battery: number,
 *   status: string,
 *   t: number,           // simulator timestamp (seconds)
 *   updatedAt: number,   // wall-clock ms (Date.now())
 *   isStale: boolean,
 *   needsAttention: boolean,
 * }
 */
const robotMap = new Map();

// Per-robot last accepted timestamp for out-of-order protection
const lastTimestamps = new Map();

let staleCheckInterval = null;

/**
 * Upsert a robot's current state.
 * Returns false if the update was rejected (out of order).
 */
function upsert(state) {
  const { robot_id, t } = state;

  // Out-of-order guard: reject updates with t <= last accepted t
  const lastT = lastTimestamps.get(robot_id);
  if (lastT !== undefined && t <= lastT) {
    return false; // silently drop stale/out-of-order update
  }

  lastTimestamps.set(robot_id, t);

  const enriched = {
    ...state,
    updatedAt: Date.now(),
    isStale: false,
    needsAttention: isAttention(state),
  };

  robotMap.set(robot_id, enriched);
  return true;
}

/**
 * Get a single robot's current state. Returns undefined if not found.
 */
function get(robotId) {
  return robotMap.get(robotId);
}

/**
 * Get all robots as an array.
 */
function getAll() {
  return Array.from(robotMap.values());
}

/**
 * Mark robots that haven't sent an update within staleTimeoutMs as stale.
 * Called on a periodic interval.
 */
function sweepStale(broadcast) {
  const now = Date.now();
  for (const [id, state] of robotMap) {
    const age = now - state.updatedAt;
    if (age > config.staleTimeoutMs && !state.isStale) {
      const staled = {
        ...state,
        isStale: true,
        status: 'offline',
        needsAttention: true,
      };
      robotMap.set(id, staled);

      if (typeof broadcast === 'function') {
        broadcast({ type: 'update', robot: staled });
      }
    }
  }
}

/**
 * Determine if a robot needs operator attention.
 */
function isAttention(state) {
  if (config.attentionStatuses.includes(state.status)) return true;
  if (state.battery <= config.lowBatteryThreshold) return true;
  return false;
}

/**
 * Start the stale-detection background sweep (every 3 seconds).
 */
function startStaleDetection(broadcast) {
  if (staleCheckInterval) clearInterval(staleCheckInterval);
  staleCheckInterval = setInterval(() => sweepStale(broadcast), 3000);
}

/**
 * Stop stale detection (useful for tests).
 */
function stopStaleDetection() {
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }
}

/**
 * Clear all state (useful for tests).
 */
function clear() {
  robotMap.clear();
  lastTimestamps.clear();
}

module.exports = {
  upsert,
  get,
  getAll,
  sweepStale,
  startStaleDetection,
  stopStaleDetection,
  isAttention,
  clear,
};
