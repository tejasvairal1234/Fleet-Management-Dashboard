'use strict';
const WebSocket = require('ws');
const robotState = require('../state/robotState');

let wss = null;
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Attach the WebSocket server to an existing HTTP server.
 */
function attach(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected from ${ip}. Total: ${wss.clients.size}`);

    // Mark alive for heartbeat
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send current fleet snapshot immediately on connection
    try {
      const snapshot = JSON.stringify({
        type: 'snapshot',
        robots: robotState.getAll(),
        timestamp: Date.now(),
      });
      ws.send(snapshot);
    } catch (err) {
      console.error('[WS] Failed to send snapshot:', err.message);
    }

    ws.on('close', () => {
      console.log(`[WS] Client disconnected. Total: ${wss.clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  // Heartbeat — detect dead connections every 15 seconds
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}

/**
 * Broadcast a message to all connected clients.
 * Handles individual send errors gracefully.
 */
function broadcast(message) {
  if (!wss) return;

  const data = typeof message === 'string' ? message : JSON.stringify(message);

  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data, (err) => {
        if (err) console.error('[WS] Broadcast send error:', err.message);
      });
    }
  });
}

/**
 * Get the number of connected clients.
 */
function clientCount() {
  return wss ? wss.clients.size : 0;
}

module.exports = { attach, broadcast, clientCount };
