/**
 * robotSimulator.js
 * Central simulation loop - one setInterval drives ALL robots.
 * Scales to 1000+ robots without creating N timers.
 */

const Robot = require("./Robot");
const logger = require("../utils/logger");
const config = require("../config/config");
const robotsJson = require("../../../data/robots.json");

// Robot type pool for generated robots beyond the seed list
const ROBOT_TYPES = ["picker", "hauler", "carrier"];

let robots = new Map();       // robot_id -> Robot instance
let simulationInterval = null;
let tickCount = 0;
let onEventCallback = null;   // called with array of events each tick

// Runtime config (can be updated via admin API)
let runtimeConfig = {
  fleetSize:        config.fleetSize,
  updateIntervalMs: config.updateIntervalMs,
};

/**
 * Build initial robot roster from robots.json + generated extras.
 */
function buildRoster(fleetSize) {
  const roster = [];

  // Use seed robots first
  for (const r of robotsJson) {
    roster.push({
      robot_id:   r.robot_id,
      robot_type: r.robot_type,
      x:          r.start.x,
      y:          r.start.y,
      battery:    40 + Math.random() * 50,
    });
  }

  // Generate extra robots if fleet size exceeds seed list
  for (let i = robotsJson.length + 1; i <= fleetSize; i++) {
    roster.push({
      robot_id:   `robot_${i}`,
      robot_type: ROBOT_TYPES[Math.floor(Math.random() * ROBOT_TYPES.length)],
      x:          10 + Math.random() * 880,
      y:          10 + Math.random() * 540,
      battery:    20 + Math.random() * 80,
    });
  }

  return roster.slice(0, fleetSize);
}

/**
 * Initialize robots based on current config.
 */
function initRobots() {
  robots.clear();
  const roster = buildRoster(runtimeConfig.fleetSize);
  for (const r of roster) {
    robots.set(r.robot_id, new Robot(r));
  }
  logger.info(`Simulator initialized with ${robots.size} robots`);
}

/**
 * Execute one simulation tick: update all robots, emit events.
 */
function tick() {
  tickCount++;
  const t = tickCount * Math.floor(runtimeConfig.updateIntervalMs / 1000);
  const events = [];

  for (const [, robot] of robots) {
    const event = robot.tick(t);
    events.push(event);
  }

  if (onEventCallback) {
    onEventCallback(events);
  }
}

/**
 * Start the simulation loop.
 */
function start(eventCallback) {
  if (simulationInterval) {
    logger.warn("Simulator already running");
    return;
  }

  onEventCallback = eventCallback;
  initRobots();

  simulationInterval = setInterval(tick, runtimeConfig.updateIntervalMs);
  logger.info(`Simulator started: ${runtimeConfig.fleetSize} robots @ ${runtimeConfig.updateIntervalMs}ms`);
}

/**
 * Stop and restart with new config.
 */
function restart(newConfig) {
  stop();
  if (newConfig.fleetSize !== undefined)        runtimeConfig.fleetSize        = newConfig.fleetSize;
  if (newConfig.updateIntervalMs !== undefined) runtimeConfig.updateIntervalMs = newConfig.updateIntervalMs;

  initRobots();
  tick();
  simulationInterval = setInterval(tick, runtimeConfig.updateIntervalMs);
  logger.info(`Simulator restarted: ${runtimeConfig.fleetSize} robots @ ${runtimeConfig.updateIntervalMs}ms`);
}

/**
 * Stop the simulation.
 */
function stop() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  tickCount = 0;
}

function getConfig() {
  return { ...runtimeConfig };
}

function getStatus() {
  return {
    running:          simulationInterval !== null,
    fleetSize:        robots.size,
    tick:             tickCount,
    updateIntervalMs: runtimeConfig.updateIntervalMs,
  };
}

module.exports = { start, stop, restart, getConfig, getStatus };
