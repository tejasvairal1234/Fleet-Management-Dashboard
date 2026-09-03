/**
 * simulatorService.js
 * Bridges the robot simulator to the fleet service ingestion layer.
 * Acts as the "ingestion pipeline" for simulator-generated events.
 */

const simulator = require("../simulator/robotSimulator");
const fleetService = require("./fleetService");
const wsServer = require("../websocket/websocketServer");
const logger = require("../utils/logger");

let running = false;

function start() {
  if (running) return;
  running = true;

  simulator.start((events) => {
    // Ingest batch into fleet state
    fleetService.ingestBatch(events);
  });

  logger.info("Simulator service started");
}

function stop() {
  if (!running) return;
  running = false;
  simulator.stop();
  logger.info("Simulator service stopped");
}

function restart(newConfig) {
  fleetService.clearFleet();
  simulator.restart(newConfig);
  wsServer.broadcastSnapshot(fleetService.getSnapshot());
  logger.info("Simulator service restarted", newConfig);
}

function getConfig() {
  return simulator.getConfig();
}

function getStatus() {
  return simulator.getStatus();
}

module.exports = { start, stop, restart, getConfig, getStatus };
