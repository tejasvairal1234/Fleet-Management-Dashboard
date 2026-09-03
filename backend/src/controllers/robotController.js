/**
 * robotController.js
 * Handles REST endpoints for robot data and event ingestion.
 */

const fleetService = require("../services/fleetService");
const logger = require("../utils/logger");

/**
 * GET /api/robots
 */
function getAllRobots(req, res) {
  const robots = fleetService.getAllRobots();
  res.json({ count: robots.length, robots });
}

/**
 * GET /api/robots/:robotId
 */
function getRobot(req, res) {
  const { robotId } = req.params;
  const robot = fleetService.getRobotState(robotId);

  if (!robot) {
    return res.status(404).json({
      error: true,
      message: `Robot ${robotId} not found`,
    });
  }

  res.json(robot);
}

/**
 * POST /api/robots/events
 * Accepts a single event or an array.
 */
function ingestEvent(req, res) {
  const body = req.body;

  if (Array.isArray(body)) {
    const results = [];
    for (const event of body) {
      const r = fleetService.ingestEvent(event);
      results.push({ robot_id: event.robot_id, accepted: r.accepted, reason: r.reason });
    }
    return res.status(207).json({ results });
  }

  const result = fleetService.ingestEvent(body);

  if (!result.accepted) {
    return res.status(400).json({
      error: true,
      message: result.reason,
    });
  }

  res.status(202).json({ accepted: true, state: result.state });
}

module.exports = { getAllRobots, getRobot, ingestEvent };
