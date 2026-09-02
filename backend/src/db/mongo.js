'use strict';
const { MongoClient } = require('mongodb');
const config = require('../config');

let client = null;
let db = null;
let connected = false;
let collection = null;

/**
 * Connect to MongoDB. Errors are caught and logged — the backend
 * continues operating without MongoDB if unavailable.
 */
async function connect() {
  try {
    if (!config.mongoUri) {
      console.warn('[MongoDB] MONGODB_URI not set — history persistence disabled');
      return;
    }

    client = new MongoClient(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(config.mongoDatabase);
    collection = db.collection('robot_events');

    // Create indexes for efficient history queries
    await collection.createIndex({ robot_id: 1, t: -1 });
    await collection.createIndex({ robot_id: 1, createdAt: -1 });

    connected = true;
    console.log('[MongoDB] Connected to', config.mongoDatabase);
  } catch (err) {
    console.warn('[MongoDB] Connection failed (history disabled):', err.message);
    connected = false;
  }
}

/**
 * Insert a single robot event. Fire-and-forget safe — callers
 * must .catch() this to avoid unhandled rejections.
 */
async function insertEvent(event) {
  if (!connected || !collection) return;

  await collection.insertOne({
    robot_id: event.robot_id,
    robot_type: event.robot_type || null,
    x: event.x,
    y: event.y,
    battery: event.battery,
    status: event.status,
    t: event.t,
    createdAt: new Date(),
  });
}

/**
 * Query historical events for a robot.
 * Supports optional from/to time range (t values in seconds).
 */
async function getHistory(robotId, { from, to, limit = 1000 } = {}) {
  if (!connected || !collection) return [];

  const query = { robot_id: robotId };
  if (from !== undefined || to !== undefined) {
    query.t = {};
    if (from !== undefined) query.t.$gte = Number(from);
    if (to !== undefined) query.t.$lte = Number(to);
  }

  return collection
    .find(query)
    .sort({ t: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Check if MongoDB is available.
 */
function isConnected() {
  return connected;
}

/**
 * Gracefully close the MongoDB connection.
 */
async function close() {
  if (client) {
    await client.close();
    connected = false;
    console.log('[MongoDB] Disconnected');
  }
}

module.exports = { connect, insertEvent, getHistory, isConnected, close };
