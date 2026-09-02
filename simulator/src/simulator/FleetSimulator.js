'use strict';
const fetch = require('node-fetch');
const { RobotAgent } = require('../robot/RobotAgent');
const { randomWaypoint } = require('../movement/MovementEngine');

// Seed robots from robots.json (the canonical 8)
const SEED_ROBOTS = require('../../../data/robots.json');

const ROBOT_TYPES = ['picker', 'hauler', 'AMR', 'sorter', 'carrier'];

/**
 * FleetSimulator — manages a fleet of RobotAgent instances and
 * periodically posts their state to the backend ingestion endpoint.
 */
class FleetSimulator {
  constructor({ backendUrl, fleetSize, intervalMs, payloadSize }) {
    this.backendUrl = backendUrl || 'http://localhost:3000';
    this.fleetSize = fleetSize || 8;
    this.intervalMs = intervalMs || 1000;
    this.payloadSize = payloadSize || 0;

    this.robots = new Map(); // robot_id → RobotAgent
    this.timer = null;
    this.tickCount = 0;
    this.stats = { sent: 0, failed: 0, lastBatchMs: 0 };
  }

  /**
   * Initialize robots from the seed file, expanding if needed.
   */
  initialize() {
    // Load seed robots
    for (const seed of SEED_ROBOTS) {
      const agent = new RobotAgent({
        robot_id: seed.robot_id,
        robot_type: seed.robot_type,
        x: seed.start.x,
        y: seed.start.y,
        battery: 30 + Math.random() * 70,
      });
      this.robots.set(seed.robot_id, agent);
    }

    // Generate additional robots if fleetSize > seed count
    this._ensureFleetSize();

    console.log(`[Simulator] Initialized ${this.robots.size} robots`);
  }

  /**
   * Start the simulator ticker.
   */
  start() {
    if (this.timer) return;
    console.log(`[Simulator] Starting — fleet: ${this.fleetSize}, interval: ${this.intervalMs}ms`);
    this.timer = setInterval(() => this._tick(), this.intervalMs);
  }

  /**
   * Stop the simulator.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Simulator] Stopped');
    }
  }

  /**
   * Dynamically change the fleet size without restart.
   */
  setFleetSize(n) {
    const prev = this.fleetSize;
    this.fleetSize = n;

    if (n > this.robots.size) {
      this._ensureFleetSize();
    } else if (n < this.robots.size) {
      this._trimFleet(n);
    }

    console.log(`[Simulator] Fleet size changed: ${prev} → ${n} (active: ${this.robots.size})`);
  }

  /**
   * Dynamically change the update interval without restart.
   */
  setInterval(ms) {
    const prev = this.intervalMs;
    this.intervalMs = ms;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this._tick(), ms);
    }

    console.log(`[Simulator] Update interval changed: ${prev}ms → ${ms}ms`);
  }

  /**
   * One simulation tick — advance all robots and send to backend.
   */
  async _tick() {
    this.tickCount++;
    const start = Date.now();

    // Advance all robots
    const events = [];
    for (const agent of this.robots.values()) {
      const event = agent.tick(this.intervalMs);

      // Add padding to hit target payload size
      if (this.payloadSize > 0) {
        event._pad = 'x'.repeat(
          Math.max(0, this.payloadSize - JSON.stringify(event).length)
        );
      }

      events.push(event);
    }

    // POST batch to backend
    try {
      const res = await fetch(`${this.backendUrl}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
        timeout: 5000,
      });

      if (!res.ok) {
        const body = await res.text();
        console.warn(`[Simulator] Backend returned ${res.status}: ${body.slice(0, 200)}`);
        this.stats.failed++;
      } else {
        this.stats.sent += events.length;
      }
    } catch (err) {
      this.stats.failed++;
      if (this.tickCount % 10 === 0) {
        console.error('[Simulator] Failed to reach backend:', err.message);
      }
    }

    this.stats.lastBatchMs = Date.now() - start;

    // Log stats every 30 ticks
    if (this.tickCount % 30 === 0) {
      console.log(
        `[Simulator] tick=${this.tickCount} robots=${this.robots.size} ` +
        `sent=${this.stats.sent} failed=${this.stats.failed} ` +
        `batchMs=${this.stats.lastBatchMs}ms`
      );
    }
  }

  /**
   * Add robots until fleet reaches target size.
   */
  _ensureFleetSize() {
    let idx = this.robots.size;
    while (this.robots.size < this.fleetSize) {
      idx++;
      const robot_id = `robot_${idx}`;
      if (this.robots.has(robot_id)) continue;

      const wp = randomWaypoint();
      const agent = new RobotAgent({
        robot_id,
        robot_type: ROBOT_TYPES[idx % ROBOT_TYPES.length],
        x: wp.x,
        y: wp.y,
        battery: 20 + Math.random() * 80,
      });
      this.robots.set(robot_id, agent);
    }
  }

  /**
   * Remove robots (non-seed ones first) to reach target size.
   */
  _trimFleet(targetSize) {
    const seedIds = new Set(SEED_ROBOTS.map(r => r.robot_id));

    // Remove dynamic robots first (not in seed)
    for (const id of this.robots.keys()) {
      if (this.robots.size <= targetSize) break;
      if (!seedIds.has(id)) {
        this.robots.delete(id);
      }
    }

    // If still over target, remove seed robots too
    for (const id of this.robots.keys()) {
      if (this.robots.size <= targetSize) break;
      this.robots.delete(id);
    }
  }
}

module.exports = { FleetSimulator };
