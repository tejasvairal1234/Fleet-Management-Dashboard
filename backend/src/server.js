/**
 * server.js
 * Entry point. Creates HTTP server, attaches WebSocket, starts simulator.
 */

require("dotenv").config();
const http = require("http");
const app  = require("./app");
const wsServer        = require("./websocket/websocketServer");
const simulatorService = require("./services/simulatorService");
const fleetService    = require("./services/fleetService");
const config = require("./config/config");
const logger = require("./utils/logger");

const server = http.createServer(app);

// Attach WebSocket to the HTTP server
wsServer.attach(server);

// Start offline detection
fleetService.startOfflineDetection();

// Start the robot simulator (feeds into fleet service)
simulatorService.start();

// Graceful shutdown
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  simulatorService.stop();
  fleetService.stopOfflineDetection();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

server.listen(config.port, () => {
  logger.info(`Fleet Management Backend running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Fleet size: ${config.fleetSize} robots`);
  logger.info(`Update interval: ${config.updateIntervalMs}ms`);
  logger.info(`WebSocket: ws://localhost:${config.port}/ws`);
});
