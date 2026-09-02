'use strict';
require('dotenv').config();
const http = require('http');
const app = require('./app');
const wsServer = require('./websocket/wsServer');
const robotState = require('./state/robotState');
const config = require('./config');

const PORT = parseInt(process.env.PORT || config.port || '3000', 10);
const HOST = '0.0.0.0';

async function main() {
  // Create HTTP server and attach WebSocket (shares the same port and server instance)
  const server = http.createServer(app);
  wsServer.attach(server);

  // Start stale detection sweep with live WebSocket broadcast
  robotState.startStaleDetection(wsServer.broadcast.bind(wsServer));

  server.listen(PORT, HOST, () => {
    console.log(`[Server] Fleet backend listening on http://${HOST}:${PORT}`);
    console.log(`[Server] WebSocket attached and available on /ws`);
    console.log('[Server] In-memory fleet state active');
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    robotState.stopStaleDetection();
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
