'use strict';
require('dotenv').config();
const http = require('http');
const app = require('./app');
const wsServer = require('./websocket/wsServer');
const db = require('./db/mongo');
const robotState = require('./state/robotState');
const config = require('./config');

const PORT = config.port;

async function main() {
  // Connect to MongoDB (non-blocking — failure is handled gracefully)
  await db.connect();

  // Create HTTP server and attach WebSocket
  const server = http.createServer(app);
  wsServer.attach(server);

  // Start stale detection sweep with live WebSocket broadcast
  robotState.startStaleDetection(wsServer.broadcast.bind(wsServer));

  server.listen(PORT, () => {
    console.log(`[Server] Fleet backend running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
    console.log(`[Server] MongoDB: ${db.isConnected() ? 'connected' : 'disconnected (history disabled)'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    robotState.stopStaleDetection();
    await db.close();
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
