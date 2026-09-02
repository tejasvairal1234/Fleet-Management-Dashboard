'use strict';
require('dotenv').config();
const WebSocket = require('ws');
const { FleetSimulator } = require('./simulator/FleetSimulator');

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';

const config = {
  backendUrl,
  fleetSize: parseInt(process.env.FLEET_SIZE || '8', 10),
  intervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '1000', 10),
  payloadSize: parseInt(process.env.PAYLOAD_SIZE || '0', 10),
};

console.log('[Simulator] Starting with config:', config);

const simulator = new FleetSimulator(config);
simulator.initialize();
simulator.start();

// ── Connect to Backend WebSocket for Runtime Fleet Controls ────────────────
let wsClient = null;
let reconnectTimer = null;

function connectConfigListener() {
  try {
    wsClient = new WebSocket(wsUrl);

    wsClient.on('open', () => {
      console.log(`[Simulator] Connected to Backend WebSocket (${wsUrl}) for runtime controls`);
    });

    wsClient.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'config' && msg.config) {
          console.log('[Simulator] Received runtime config update:', msg.config);
          if (typeof msg.config.fleetSize === 'number') {
            simulator.setFleetSize(msg.config.fleetSize);
          }
          if (typeof msg.config.updateIntervalMs === 'number') {
            simulator.setInterval(msg.config.updateIntervalMs);
          }
        }
      } catch (err) {
        console.error('[Simulator] WS message parse error:', err.message);
      }
    });

    wsClient.on('close', () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectConfigListener, 3000);
    });

    wsClient.on('error', () => {
      wsClient.close();
    });
  } catch (err) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectConfigListener, 5000);
  }
}

connectConfigListener();

// Graceful shutdown
process.on('SIGTERM', () => {
  if (wsClient) wsClient.close();
  simulator.stop();
  process.exit(0);
});
process.on('SIGINT', () => {
  if (wsClient) wsClient.close();
  simulator.stop();
  process.exit(0);
});
