/**
 * errorHandler.js
 * Centralized Express error handling middleware.
 */

const logger = require("../utils/logger");

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(`${req.method} ${req.path} -> ${status}: ${message}`);

  res.status(status).json({
    error: true,
    status,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({
    error: true,
    status: 404,
    message: `Route not found: ${req.method} ${req.path}`,
  });
}

module.exports = { errorHandler, notFound };
