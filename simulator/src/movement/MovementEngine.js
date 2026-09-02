'use strict';

// ── Site boundaries (from layout.png: 900×560px) ──────────────────────────────
const MAP_WIDTH = 900;
const MAP_HEIGHT = 560;
const MARGIN = 5; // keep robots away from the very edge

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pick a random waypoint within the site boundaries.
 */
function randomWaypoint() {
  return {
    x: MARGIN + Math.random() * (MAP_WIDTH - 2 * MARGIN),
    y: MARGIN + Math.random() * (MAP_HEIGHT - 2 * MARGIN),
  };
}

/**
 * Compute the distance between two points.
 */
function distance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Move `current` toward `target` by at most `maxStep` units.
 * Returns the new position (clamped within site boundaries).
 */
function stepToward(current, target, maxStep) {
  const dist = distance(current, target);
  if (dist <= maxStep) {
    return {
      x: clamp(target.x, MARGIN, MAP_WIDTH - MARGIN),
      y: clamp(target.y, MARGIN, MAP_HEIGHT - MARGIN),
    };
  }

  const ratio = maxStep / dist;
  return {
    x: clamp(current.x + (target.x - current.x) * ratio, MARGIN, MAP_WIDTH - MARGIN),
    y: clamp(current.y + (target.y - current.y) * ratio, MARGIN, MAP_HEIGHT - MARGIN),
  };
}

/**
 * Add a small random jitter to simulate imprecise movement.
 */
function jitter(pos, amount = 1.5) {
  return {
    x: clamp(pos.x + (Math.random() - 0.5) * amount * 2, MARGIN, MAP_WIDTH - MARGIN),
    y: clamp(pos.y + (Math.random() - 0.5) * amount * 2, MARGIN, MAP_HEIGHT - MARGIN),
  };
}

module.exports = { randomWaypoint, stepToward, distance, jitter, clamp, MAP_WIDTH, MAP_HEIGHT };
