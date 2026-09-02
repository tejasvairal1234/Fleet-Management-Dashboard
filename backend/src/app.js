'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

// Simple request logger in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    if (req.path !== '/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/', routes);

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
