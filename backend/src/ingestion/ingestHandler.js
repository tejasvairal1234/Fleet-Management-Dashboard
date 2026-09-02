'use strict';
const { validate } = require('./validator');
const robotState = require('../state/robotState');
const db = require('../db/mongo');

/**
 * Process a single robot event:
 *   1. Validate payload
 *   2. Update in-memory state
 *   3. Broadcast via WebSocket (injected to avoid circular deps)
 *   4. Async persist to MongoDB (fire-and-forget)
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
    // Out-of-order — not an error, just silently skip broadcast/persist
    return { accepted: false, errors: ['Out-of-order update rejected'] };
  }

  const currentState = robotState.get(payload.robot_id);

  // Broadcast to all connected WebSocket clients (non-blocking)
  if (typeof broadcast === 'function') {
    broadcast({ type: 'update', robot: currentState });
  }

  // Persist to MongoDB asynchronously — never block on this
  db.insertEvent(payload).catch((err) => {
    // Log but do not throw — MongoDB failure must not freeze ingestion
    console.error('[MongoDB] Failed to persist event:', err.message);
  });

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
