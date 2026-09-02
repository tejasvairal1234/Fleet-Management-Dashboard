'use strict';
const { randomWaypoint, stepToward, distance, jitter, MAP_WIDTH, MAP_HEIGHT } = require('../movement/MovementEngine');

// ── Status definitions ────────────────────────────────────────────────────────

const STATUSES = ['idle', 'active', 'on_mission', 'charging', 'blocked', 'error', 'maintenance', 'offline'];

// Movement speed (px/tick) per status
const SPEED = {
  idle: 0,
  active: 8,
  on_mission: 12,
  charging: 0,
  blocked: 0,
  error: 0,
  maintenance: 0,
  offline: 0,
};

// Battery drain per tick (per second equivalent)
const BATTERY_DRAIN = {
  idle: -0.05,
  active: -0.15,
  on_mission: -0.20,
  charging: +0.80,
  blocked: -0.03,
  error: -0.02,
  maintenance: -0.01,
  offline: 0,
};

// Minimum ticks to stay in a status before transitioning
const MIN_DURATION = {
  idle: 3,
  active: 5,
  on_mission: 8,
  charging: 15,
  blocked: 3,
  error: 4,
  maintenance: 8,
  offline: 5,
};

// Transition table: from -> { to: probability }
// Probabilities must roughly sum to ≤ 1 (remainder = stay)
const TRANSITIONS = {
  idle: { active: 0.12, on_mission: 0.10, charging: 0.04, maintenance: 0.02 },
  active: { on_mission: 0.20, idle: 0.10, blocked: 0.05, error: 0.02 },
  on_mission: { active: 0.15, idle: 0.10, blocked: 0.06, error: 0.03, offline: 0.01 },
  charging: { idle: 0.08 },   // only transition when battery is full enough
  blocked: { active: 0.20, idle: 0.10, error: 0.05 },
  error: { idle: 0.10, maintenance: 0.05, offline: 0.02 },
  maintenance: { idle: 0.08, active: 0.04 },
  offline: { idle: 0.15 },
};

let globalTick = 0; // monotonic tick counter used as simulator timestamp

/**
 * RobotAgent — represents a single robot in the simulation.
 *
 * Each tick:
 *   1. Update battery
 *   2. Maybe transition status
 *   3. Move toward waypoint (if mobile)
 *   4. Return current event payload
 */
class RobotAgent {
  constructor({ robot_id, robot_type, x, y, battery }) {
    this.robot_id = robot_id;
    this.robot_type = robot_type || 'picker';
    this.x = x;
    this.y = y;
    this.battery = battery !== undefined ? battery : 50 + Math.random() * 50;
    this.status = 'idle';
    this.ticksInStatus = 0;
    this.waypoint = randomWaypoint();
    this.t = 0; // monotonic simulator time in seconds
  }

  /**
   * Advance the robot by one tick.
   * @param {number} intervalMs - tick duration in ms (for t advancement)
   */
  tick(intervalMs) {
    this.t += intervalMs / 1000;
    this.ticksInStatus++;

    // 1. Battery logic ─────────────────────────────────────────────────────────
    const drain = BATTERY_DRAIN[this.status] || 0;
    this.battery = Math.max(0, Math.min(100, this.battery + drain));

    // 2. Low battery → force charging ─────────────────────────────────────────
    if (this.battery < 12 && this.status !== 'charging' && this.status !== 'offline') {
      this._transition('charging');
    }

    // Charging complete → go idle
    if (this.status === 'charging' && this.battery >= 95) {
      this._transition('idle');
    }

    // 3. Stochastic status transitions ────────────────────────────────────────
    if (this.ticksInStatus >= MIN_DURATION[this.status]) {
      this._maybeTransition();
    }

    // 4. Movement ──────────────────────────────────────────────────────────────
    const speed = SPEED[this.status] || 0;
    if (speed > 0) {
      // Check if we've reached the waypoint
      if (distance({ x: this.x, y: this.y }, this.waypoint) < speed * 1.5) {
        this.waypoint = randomWaypoint();
      }

      const next = stepToward({ x: this.x, y: this.y }, this.waypoint, speed);
      const withJitter = jitter(next, 0.5);
      this.x = withJitter.x;
      this.y = withJitter.y;
    }

    return this._toEvent();
  }

  /**
   * Attempt a random status transition based on the probability table.
   */
  _maybeTransition() {
    const table = TRANSITIONS[this.status] || {};
    const roll = Math.random();
    let cumulative = 0;

    for (const [nextStatus, prob] of Object.entries(table)) {
      cumulative += prob;
      if (roll < cumulative) {
        this._transition(nextStatus);
        return;
      }
    }
    // No transition — stay in current status
  }

  _transition(newStatus) {
    this.status = newStatus;
    this.ticksInStatus = 0;

    // Pick a new waypoint when starting a mission or becoming active
    if (newStatus === 'active' || newStatus === 'on_mission') {
      this.waypoint = randomWaypoint();
    }
  }

  /**
   * Build the event payload for backend ingestion.
   */
  _toEvent() {
    return {
      robot_id: this.robot_id,
      robot_type: this.robot_type,
      x: Math.round(this.x * 10) / 10,
      y: Math.round(this.y * 10) / 10,
      battery: Math.round(this.battery * 10) / 10,
      status: this.status,
      t: Math.round(this.t * 10) / 10,
    };
  }
}

module.exports = { RobotAgent };
