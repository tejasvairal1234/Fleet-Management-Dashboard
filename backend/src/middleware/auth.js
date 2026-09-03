/**
 * auth.js
 * Admin API key middleware.
 * Checks X-Admin-Key header against ADMIN_API_KEY env var.
 */

const config = require("../config/config");

function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== config.adminApiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid X-Admin-Key header required",
    });
  }
  next();
}

module.exports = { requireAdminKey };
