'use strict';
const { validate } = require('./validator');
const robotState = require('../state/robotState');

/**
 * Process a single robot event:
 *   1. Validate payload schema & values
 *   2. Update in-memory state (with out-of-order protection)
 *   3. Broadcast via WebSocket (injected to avoid circular deps)
 *
 * Returns { accepted: boolean, errors?: string[] }
 */
function ingest(payload, broadcast) {
  const { valid, errors } = validate(payload);
  if (!valid) {
    return { accepted: false, errors };
  }

  const accepted = robotState.upsert(payload);
  if (!accepted) {
    // Out-of-order — not a server error, reject to preserve latest state
    return { accepted: false, errors: ['Out-of-order update rejected'] };
  }

  const currentState = robotState.get(payload.robot_id);

  // Broadcast to all connected WebSocket clients (non-blocking)
  if (typeof broadcast === 'function') {
    broadcast({ type: 'update', robot: currentState });
  }

  return { accepted: true };
}

/**
 * Process a batch of robot events (array).
 * Returns array of results.
 */
function ingestBatch(payloads, broadcast) {
  if (!Array.isArray(payloads)) {
    return [{ accepted: false, errors: ['Batch must be an array'] }];
  }
  return payloads.map((p) => ingest(p, broadcast));
}

module.exports = { ingest, ingestBatch };
