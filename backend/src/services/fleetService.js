/**
 * fleetService.js
 * Authoritative fleet state as Map<robot_id, robotState>.
 */

const config  = require("../config/config");
const logger  = require("../utils/logger");

const fleetState = new Map();
let offlineDetectionInterval = null;
let onStateChange = null;

const VALID_STATUSES = new Set([
  "idle", "active", "on_mission", "charging",
  "blocked", "error", "maintenance", "offline",
]);

function setOnStateChange(cb) {
  onStateChange = cb;
}

function validateEvent(event) {
  if (!event || typeof event !== "object") {
    return { valid: false, error: "Event must be an object" };
  }

  const { robot_id, x, y, status, battery, t } = event;

  if (!robot_id || typeof robot_id !== "string" || robot_id.trim() === "") {
    return { valid: false, error: "Invalid robot_id" };
  }
  if (typeof x !== "number" || x < 0 || x > config.site.width) {
    return { valid: false, error: `x out of range [0, ${config.site.width}]` };
  }
  if (typeof y !== "number" || y < 0 || y > config.site.height) {
    return { valid: false, error: `y out of range [0, ${config.site.height}]` };
  }
  if (!VALID_STATUSES.has(status)) {
    return { valid: false, error: `Invalid status: ${status}` };
  }
  if (typeof battery !== "number" || battery < 0 || battery > 100) {
    return { valid: false, error: "Battery must be 0-100" };
  }
  if (typeof t !== "number" || t < 0) {
    return { valid: false, error: "Invalid timestamp t" };
  }

  return { valid: true };
}

function ingestEvent(event) {
  const validation = validateEvent(event);
  if (!validation.valid) {
    return { accepted: false, reason: validation.error };
  }

  const { robot_id, robot_type, x, y, status, battery, t } = event;
  const current = fleetState.get(robot_id);

  // Out-of-order: reject stale events
  if (current && t < current.t) {
    return {
      accepted: false,
      reason: `Stale event: incoming t=${t} < current t=${current.t}`,
    };
  }

  const now = Date.now();
  const newState = {
    robot_id,
    robot_type: robot_type || (current ? current.robot_type : "unknown"),
    x,
    y,
    status,
    battery,
    t,
    last_seen: now,
  };

  fleetState.set(robot_id, newState);

  if (onStateChange) {
    onStateChange(newState);
  }

  return { accepted: true, state: newState };
}

function ingestBatch(events) {
  const results = [];
  for (const event of events) {
    const r = ingestEvent(event);
    if (!r.accepted) {
      logger.debug(`Rejected event for ${event.robot_id}: ${r.reason}`);
    } else {
      results.push(r.state);
    }
  }
  return results;
}

function getRobotState(robotId) {
  return fleetState.get(robotId) || null;
}

function getAllRobots() {
  return Array.from(fleetState.values());
}

function getSnapshot() {
  return getAllRobots();
}

function markOffline(robotId) {
  const state = fleetState.get(robotId);
  if (state && state.status !== "offline") {
    state.status = "offline";
    if (onStateChange) onStateChange({ ...state });
    logger.debug(`Robot ${robotId} marked offline (timeout)`);
  }
}

function startOfflineDetection() {
  const checkInterval = Math.max(1000, config.robotTimeoutMs / 2);
  offlineDetectionInterval = setInterval(() => {
    const now = Date.now();
    for (const [robotId, state] of fleetState) {
      if (state.status !== "offline" && now - state.last_seen > config.robotTimeoutMs) {
        markOffline(robotId);
      }
    }
  }, checkInterval);
  logger.info(`Offline detection: check every ${checkInterval}ms, timeout ${config.robotTimeoutMs}ms`);
}

function stopOfflineDetection() {
  if (offlineDetectionInterval) {
    clearInterval(offlineDetectionInterval);
    offlineDetectionInterval = null;
  }
}

function clearFleet() {
  fleetState.clear();
}

module.exports = {
  setOnStateChange,
  validateEvent,
  ingestEvent,
  ingestBatch,
  getRobotState,
  getAllRobots,
  getSnapshot,
  startOfflineDetection,
  stopOfflineDetection,
  clearFleet,
};
