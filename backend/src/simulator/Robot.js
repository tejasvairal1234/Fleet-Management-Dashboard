/**
 * Robot.js
 * Encapsulates a single robot instance with state-machine logic.
 */

const { computeNextPosition } = require("./movement");

const STATE_DURATIONS = {
  blocked:     { min: 2, max: 8 },
  error:       { min: 3, max: 10 },
  maintenance: { min: 5, max: 20 },
  charging:    { min: 10, max: 30 },
  offline:     { min: 2, max: 6 },
};

const BATTERY_DRAIN = {
  idle:        0.05,
  active:      0.25,
  on_mission:  0.30,
  charging:   -2.50,
  blocked:     0.05,
  error:       0.02,
  maintenance: 0.01,
  offline:     0.0,
};

const SPEEDS = {
  picker:  3.5,
  hauler:  5.0,
  carrier: 4.0,
  default: 4.0,
};

class Robot {
  constructor({ robot_id, robot_type, x, y, battery, status }) {
    this.robot_id   = robot_id;
    this.robot_type = robot_type || "picker";
    this.x          = x;
    this.y          = y;
    this.battery    = battery !== undefined ? battery : 80 + Math.random() * 20;
    this.status     = status || "idle";
    this.speed      = (SPEEDS[this.robot_type] || SPEEDS.default) * (0.8 + Math.random() * 0.4);

    this._stateTicksRemaining = 0;
    this._previousStatus      = "idle";
    this._offlineChance       = 0.001 + (Math.random() - 0.5) * 0.001;
    this._errorChance         = 0.002;
    this._blockChance         = 0.005 + (Math.random() - 0.5) * 0.003;
  }

  tick(t) {
    this._updateStatus();
    this._updateBattery();
    this._updatePosition();

    return {
      t,
      robot_id:   this.robot_id,
      robot_type: this.robot_type,
      x:          this.x,
      y:          this.y,
      status:     this.status,
      battery:    parseFloat(this.battery.toFixed(1)),
    };
  }

  _updateStatus() {
    if (this._stateTicksRemaining > 0) {
      this._stateTicksRemaining--;
      if (this._stateTicksRemaining === 0) {
        this._exitTransientState();
      }
      return;
    }

    if (this.battery < 15 && this.status !== "charging" && this.status !== "offline") {
      this._enterState("charging");
      return;
    }

    if (Math.random() < this._offlineChance && this.status !== "offline") {
      this._previousStatus = this.status;
      this._enterState("offline");
      return;
    }

    switch (this.status) {
      case "idle":
        if (Math.random() < 0.08) {
          this._enterState(Math.random() < 0.5 ? "active" : "on_mission");
        }
        break;
      case "active":
        if (Math.random() < this._blockChance) {
          this._previousStatus = "active";
          this._enterState("blocked");
        } else if (Math.random() < this._errorChance) {
          this._previousStatus = "active";
          this._enterState("error");
        } else if (Math.random() < 0.05) {
          this.status = "on_mission";
        } else if (Math.random() < 0.04) {
          this.status = "idle";
        }
        break;
      case "on_mission":
        if (Math.random() < this._errorChance) {
          this._previousStatus = "on_mission";
          this._enterState("error");
        } else if (Math.random() < 0.04) {
          this.status = "active";
        } else if (Math.random() < 0.02) {
          this.status = "idle";
        }
        break;
      case "charging":
        if (this.battery >= 95) {
          this._stateTicksRemaining = 0;
          this.status = "idle";
        }
        break;
      default:
        break;
    }
  }

  _enterState(newStatus) {
    const dur = STATE_DURATIONS[newStatus];
    if (dur) {
      this._stateTicksRemaining = dur.min + Math.floor(Math.random() * (dur.max - dur.min));
    }
    this.status = newStatus;
  }

  _exitTransientState() {
    switch (this.status) {
      case "blocked":     this.status = this._previousStatus || "active"; break;
      case "error":       this._enterState("maintenance"); break;
      case "maintenance": this.status = "idle"; break;
      case "charging":    this.status = "idle"; break;
      case "offline":     this.status = this._previousStatus || "idle"; break;
      default:            this.status = "idle";
    }
  }

  _updateBattery() {
    const drain = BATTERY_DRAIN[this.status] ?? 0;
    this.battery = Math.max(0, Math.min(100, this.battery - drain));
  }

  _updatePosition() {
    const isMoving = this.status === "active" || this.status === "on_mission";
    const result = computeNextPosition(
      { robot_id: this.robot_id, x: this.x, y: this.y, speed: this.speed },
      isMoving
    );
    this.x = result.x;
    this.y = result.y;
  }

  toState() {
    return {
      robot_id:   this.robot_id,
      robot_type: this.robot_type,
      x:          this.x,
      y:          this.y,
      status:     this.status,
      battery:    parseFloat(this.battery.toFixed(1)),
    };
  }
}

module.exports = Robot;
