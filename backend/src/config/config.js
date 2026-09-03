require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  adminApiKey: process.env.ADMIN_API_KEY || "change-me",

  // Simulator
  fleetSize: parseInt(process.env.FLEET_SIZE, 10) || 200,
  updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS, 10) || 1000,
  payloadSize: parseInt(process.env.PAYLOAD_SIZE, 10) || 512,
  robotTimeoutMs: parseInt(process.env.ROBOT_TIMEOUT_MS, 10) || 10000,

  // Site dimensions (from layout.png metadata)
  site: {
    width: 900,
    height: 560,
  },
};

module.exports = config;
