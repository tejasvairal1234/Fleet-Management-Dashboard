'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const robotState = require('../state/robotState');
const { ingest, ingestBatch } = require('../ingestion/ingestHandler');
const wsServer = require('../websocket/wsServer');
const config = require('../config');

const router = express.Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

const ingestLimiter = rateLimit({
  windowMs: 1000,       // 1 second
  max: 10000,           // allow up to 10k updates/s (scaled for 2000+ robots)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — rate limit exceeded' },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,
  message: { error: 'Too many admin requests' },
});

// ── Admin auth middleware ─────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== config.adminToken) {
    return res.status(401).json({ error: 'Unauthorized — valid admin token required' });
  }
  next();
}

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    robots: robotState.getAll().length,
    wsClients: wsServer.clientCount(),
    timestamp: Date.now(),
  });
});

// ── Current State (In-Memory Map) ─────────────────────────────────────────────

router.get('/robots', (req, res) => {
  res.json(robotState.getAll());
});

router.get('/robots/:robotId', (req, res) => {
  const robot = robotState.get(req.params.robotId);
  if (!robot) {
    return res.status(404).json({ error: 'Robot not found' });
  }
  res.json(robot);
});

// ── Ingestion ─────────────────────────────────────────────────────────────────

router.post('/ingest', ingestLimiter, (req, res) => {
  const payload = req.body;

  // Support both single event and batch array
  if (Array.isArray(payload)) {
    const results = ingestBatch(payload, wsServer.broadcast.bind(wsServer));
    const accepted = results.filter((r) => r.accepted).length;
    return res.status(200).json({ accepted, total: results.length, results });
  }

  const result = ingest(payload, wsServer.broadcast.bind(wsServer));
  if (!result.accepted) {
    return res.status(400).json({ error: 'Update rejected', details: result.errors });
  }
  res.status(200).json({ accepted: true });
});

// ── Config (admin-protected) ──────────────────────────────────────────────────

// Runtime config state — mutable without restart
const runtimeConfig = {
  fleetSize: parseInt(process.env.FLEET_SIZE || '8', 10),
  updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '1000', 10),
};

router.get('/config', adminLimiter, requireAdmin, (req, res) => {
  res.json({
    fleetSize: runtimeConfig.fleetSize,
    updateIntervalMs: runtimeConfig.updateIntervalMs,
    staleTimeoutMs: config.staleTimeoutMs,
    mapWidth: config.mapWidth,
    mapHeight: config.mapHeight,
  });
});

router.post('/config', adminLimiter, requireAdmin, (req, res) => {
  const { fleetSize, updateIntervalMs } = req.body;
  const errors = [];

  if (fleetSize !== undefined) {
    const n = parseInt(fleetSize, 10);
    if (isNaN(n) || n < 1 || n > 10000) {
      errors.push('fleetSize must be an integer between 1 and 10000');
    } else {
      runtimeConfig.fleetSize = n;
    }
  }

  if (updateIntervalMs !== undefined) {
    const ms = parseInt(updateIntervalMs, 10);
    if (isNaN(ms) || ms < 100 || ms > 60000) {
      errors.push('updateIntervalMs must be between 100 and 60000');
    } else {
      runtimeConfig.updateIntervalMs = ms;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Broadcast config change to all WS clients so simulator can pick it up
  wsServer.broadcast({ type: 'config', config: runtimeConfig });

  res.json({
    updated: true,
    config: runtimeConfig,
  });
});

module.exports = router;
module.exports.getRuntimeConfig = () => ({ ...runtimeConfig });
