'use strict';
const config = require('../config');

/**
 * Validate an incoming robot event payload.
 * Returns { valid: boolean, errors: string[] }
 */
function validate(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object'] };
  }

  // robot_id
  if (typeof payload.robot_id !== 'string' || payload.robot_id.trim() === '') {
    errors.push('robot_id must be a non-empty string');
  }

  // x coordinate
  if (typeof payload.x !== 'number' || isNaN(payload.x)) {
    errors.push('x must be a number');
  } else if (payload.x < 0 || payload.x > config.mapWidth) {
    errors.push(`x must be between 0 and ${config.mapWidth}`);
  }

  // y coordinate
  if (typeof payload.y !== 'number' || isNaN(payload.y)) {
    errors.push('y must be a number');
  } else if (payload.y < 0 || payload.y > config.mapHeight) {
    errors.push(`y must be between 0 and ${config.mapHeight}`);
  }

  // battery
  if (typeof payload.battery !== 'number' || isNaN(payload.battery)) {
    errors.push('battery must be a number');
  } else if (payload.battery < 0 || payload.battery > 100) {
    errors.push('battery must be between 0 and 100');
  }

  // status
  if (!config.validStatuses.includes(payload.status)) {
    errors.push(`status must be one of: ${config.validStatuses.join(', ')}`);
  }

  // t (timestamp in seconds)
  if (typeof payload.t !== 'number' || isNaN(payload.t) || payload.t < 0) {
    errors.push('t must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validate };
