'use strict';
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongoDatabase: process.env.MONGODB_DATABASE || 'fleet',
  adminToken: process.env.ADMIN_TOKEN || 'changeme-admin-token',
  staleTimeoutMs: parseInt(process.env.ROBOT_STALE_TIMEOUT_MS || '10000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Map dimensions (from layout.png)
  mapWidth: 900,
  mapHeight: 560,

  // Valid robot statuses
  validStatuses: [
    'idle', 'active', 'on_mission', 'charging',
    'blocked', 'error', 'maintenance', 'offline'
  ],

  // Attention statuses — robots in these states need operator attention
  attentionStatuses: ['error', 'blocked', 'maintenance', 'offline'],
  lowBatteryThreshold: 20,
};

module.exports = config;
