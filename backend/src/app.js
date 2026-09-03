/**
 * app.js
 * Express application setup.
 */

const express = require("express");
const helmet  = require("helmet");
const cors    = require("cors");
const rateLimit = require("express-rate-limit");

const config = require("./config/config");
const logger = require("./utils/logger");
const robotRoutes     = require("./routes/robotRoutes");
const simulatorRoutes = require("./routes/simulatorRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const fleetService    = require("./services/fleetService");
const wsServer        = require("./websocket/websocketServer");

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Admin-Key"],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: true, message: "Too many requests" },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    fleetSize: fleetService.getAllRobots().length,
    connectedClients: wsServer.getClientCount(),
    uptime: process.uptime(),
  });
});

// Routes
app.use("/api/robots",    robotRoutes);
app.use("/api/simulator", simulatorRoutes);

// 404 & Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
