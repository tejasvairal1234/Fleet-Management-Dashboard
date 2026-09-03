/**
 * movement.js
 * Handles robot position updates with realistic physics.
 * Robots move gradually (max ~8px per tick), change direction smoothly,
 * and stay strictly within site boundaries.
 */

const SITE_WIDTH  = 900;
const SITE_HEIGHT = 560;
const MARGIN = 10;

// Per-robot velocity state
const robotVelocities = new Map();

function getVelocity(robotId, speed) {
  if (!robotVelocities.has(robotId)) {
    const angle = Math.random() * Math.PI * 2;
    robotVelocities.set(robotId, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
  return robotVelocities.get(robotId);
}

function clearVelocity(robotId) {
  robotVelocities.delete(robotId);
}

/**
 * Compute next position for a robot.
 * @param {{ robot_id, x, y, speed }} robot
 * @param {boolean} isMoving
 */
function computeNextPosition(robot, isMoving) {
  const { robot_id, x, y, speed } = robot;
  if (!isMoving) return { x, y };

  const vel = getVelocity(robot_id, speed);

  // Small random turn each tick for organic movement
  const turnAngle = (Math.random() - 0.5) * 0.3;
  const cosA = Math.cos(turnAngle);
  const sinA = Math.sin(turnAngle);

  // Apply rotation (fix: store old vx before using it)
  const oldVx = vel.vx;
  const oldVy = vel.vy;
  vel.vx = oldVx * cosA - oldVy * sinA;
  vel.vy = oldVx * sinA + oldVy * cosA;

  // Normalize to desired speed
  const mag = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
  if (mag > 0.001) {
    vel.vx = (vel.vx / mag) * speed;
    vel.vy = (vel.vy / mag) * speed;
  }

  let nx = x + vel.vx;
  let ny = y + vel.vy;

  // Bounce off boundaries
  if (nx < MARGIN) { vel.vx =  Math.abs(vel.vx); nx = MARGIN; }
  if (nx > SITE_WIDTH  - MARGIN) { vel.vx = -Math.abs(vel.vx); nx = SITE_WIDTH  - MARGIN; }
  if (ny < MARGIN) { vel.vy =  Math.abs(vel.vy); ny = MARGIN; }
  if (ny > SITE_HEIGHT - MARGIN) { vel.vy = -Math.abs(vel.vy); ny = SITE_HEIGHT - MARGIN; }

  return {
    x: parseFloat(nx.toFixed(1)),
    y: parseFloat(ny.toFixed(1)),
  };
}

module.exports = { computeNextPosition, clearVelocity };
