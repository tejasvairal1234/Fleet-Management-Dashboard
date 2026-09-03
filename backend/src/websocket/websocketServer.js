/**
 * websocketServer.js
 * Manages all dashboard WebSocket clients.
 *
 * Protocol:
 *   - On connect: send { type: "snapshot", robots: [...] }
 *   - On robot update: send { type: "robot_update", robot: {...} }
 *
 * Design:
 *   - Dead clients cleaned up proactively (ping/pong)
 *   - Does NOT block ingestion if one client is slow
 *   - Multiple clients supported
 */

const { WebSocketServer, WebSocket } = require("ws");
const fleetService = require("../services/fleetService");
const logger = require("../utils/logger");

let wss = null;
const clients = new Set();

/**
 * Attach WebSocket server to existing HTTP server.
 */
function attach(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`WS client connected from ${ip}. Total clients: ${clients.size + 1}`);

    ws.isAlive = true;
    clients.add(ws);

    // Send current snapshot immediately
    const snapshot = fleetService.getSnapshot();
    safeSend(ws, { type: "snapshot", robots: snapshot });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      // Clients don"t send commands in this protocol, but handle gracefully
      try {
        const msg = JSON.parse(data);
        logger.debug("WS message received", msg);
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      logger.info(`WS client disconnected. Remaining: ${clients.size}`);
    });

    ws.on("error", (err) => {
      logger.warn(`WS client error: ${err.message}`);
      clients.delete(ws);
    });
  });

  // Heartbeat: ping every 15s to detect dead connections
  const pingInterval = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) {
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 15000);

  wss.on("close", () => clearInterval(pingInterval));

  // Register fleet state change handler
  fleetService.setOnStateChange((updatedRobot) => {
    broadcastRobotUpdate(updatedRobot);
  });

  logger.info("WebSocket server attached at /ws");
}

/**
 * Broadcast a single robot update to all connected clients.
 * Non-blocking: dead clients are skipped and removed.
 */
function broadcastRobotUpdate(robot) {
  const payload = JSON.stringify({ type: "robot_update", robot });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload, (err) => {
        if (err) {
          clients.delete(ws);
          logger.debug(`Removed dead WS client: ${err.message}`);
        }
      });
    } else {
      clients.delete(ws);
    }
  }
}

/**
 * Broadcast a snapshot of all robots to all connected clients.
 */
function broadcastSnapshot(snapshot) {
  const payload = JSON.stringify({ type: "snapshot", robots: snapshot });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload, (err) => {
        if (err) {
          clients.delete(ws);
          logger.debug(`Removed dead WS client: ${err.message}`);
        }
      });
    } else {
      clients.delete(ws);
    }
  }
}

/**
 * Send to a single client safely.
 */
function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data), (err) => {
      if (err) logger.warn(`WS send error: ${err.message}`);
    });
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { attach, getClientCount, broadcastSnapshot };

