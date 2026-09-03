/**
 * simulatorController.js
 * Admin endpoints for simulator configuration.
 */

const simulatorService = require("../services/simulatorService");
const logger = require("../utils/logger");

/**
 * GET /api/simulator/config
 */
function getConfig(req, res) {
  const cfg = simulatorService.getConfig();
  const status = simulatorService.getStatus();
  res.json({
    fleetSize: cfg.fleetSize,
    updateIntervalMs: cfg.updateIntervalMs,
    running: status.running,
    activeRobots: status.fleetSize,
    tick: status.tick,
  });
}

/**
 * PUT /api/simulator/config
 * Body: { fleetSize?: number, updateIntervalMs?: number }
 */
function updateConfig(req, res) {
  const { fleetSize, updateIntervalMs } = req.body;
  const errors = [];

  if (fleetSize !== undefined) {
    if (!Number.isInteger(fleetSize) || fleetSize < 1 || fleetSize > 2000) {
      errors.push("fleetSize must be integer 1-2000");
    }
  }
  if (updateIntervalMs !== undefined) {
    if (!Number.isInteger(updateIntervalMs) || updateIntervalMs < 100 || updateIntervalMs > 60000) {
      errors.push("updateIntervalMs must be integer 100-60000");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: true,
      message: errors.join(", "),
      messages: errors,
    });
  }

  const newConfig = {};
  if (fleetSize !== undefined)        newConfig.fleetSize = fleetSize;
  if (updateIntervalMs !== undefined) newConfig.updateIntervalMs = updateIntervalMs;

  simulatorService.restart(newConfig);

  logger.info("Simulator config updated", newConfig);
  res.json({ accepted: true, config: simulatorService.getConfig() });
}

module.exports = { getConfig, updateConfig };
