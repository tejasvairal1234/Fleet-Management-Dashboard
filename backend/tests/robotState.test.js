'use strict';
const robotState = require('../src/state/robotState');

describe('RobotState In-Memory Manager', () => {
  beforeEach(() => {
    robotState.clear();
  });

  afterEach(() => {
    robotState.stopStaleDetection();
  });

  const baseEvent = {
    robot_id: 'r1',
    robot_type: 'picker',
    x: 100,
    y: 150,
    battery: 90,
    status: 'idle',
    t: 1.0,
  };

  test('upserts a new robot into in-memory Map', () => {
    const accepted = robotState.upsert(baseEvent);
    expect(accepted).toBe(true);

    const robot = robotState.get('r1');
    expect(robot).toBeDefined();
    expect(robot.robot_id).toBe('r1');
    expect(robot.x).toBe(100);
    expect(robot.isStale).toBe(false);
    expect(robot.updatedAt).toBeGreaterThan(0);
  });

  test('getAll returns array of all stored robots', () => {
    robotState.upsert({ ...baseEvent, robot_id: 'r1', t: 1 });
    robotState.upsert({ ...baseEvent, robot_id: 'r2', t: 1 });
    robotState.upsert({ ...baseEvent, robot_id: 'r3', t: 1 });

    const all = robotState.getAll();
    expect(all).toHaveLength(3);
    expect(all.map(r => r.robot_id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  test('out-of-order protection rejects older or equal timestamp events', () => {
    expect(robotState.upsert({ ...baseEvent, t: 10 })).toBe(true);
    expect(robotState.get('r1').x).toBe(100);

    // Incoming event with t=5 (older)
    const lateOlder = robotState.upsert({ ...baseEvent, x: 500, t: 5 });
    expect(lateOlder).toBe(false);
    expect(robotState.get('r1').x).toBe(100); // position preserved at t=10

    // Incoming event with t=10 (duplicate timestamp)
    const duplicate = robotState.upsert({ ...baseEvent, x: 600, t: 10 });
    expect(duplicate).toBe(false);
    expect(robotState.get('r1').x).toBe(100);

    // Incoming event with t=11 (newer)
    const newer = robotState.upsert({ ...baseEvent, x: 250, t: 11 });
    expect(newer).toBe(true);
    expect(robotState.get('r1').x).toBe(250);
  });

  test('correctly classifies attention status conditions', () => {
    expect(robotState.isAttention({ status: 'error', battery: 80 })).toBe(true);
    expect(robotState.isAttention({ status: 'blocked', battery: 80 })).toBe(true);
    expect(robotState.isAttention({ status: 'maintenance', battery: 80 })).toBe(true);
    expect(robotState.isAttention({ status: 'offline', battery: 80 })).toBe(true);
    expect(robotState.isAttention({ status: 'active', battery: 15 })).toBe(true); // low battery <= 20%
    expect(robotState.isAttention({ status: 'active', battery: 80 })).toBe(false);
    expect(robotState.isAttention({ status: 'idle', battery: 50 })).toBe(false);
  });

  test('sweepStale marks inactive robots as offline and broadcasts', () => {
    robotState.upsert(baseEvent);

    // Manually artificially age the updatedAt timestamp
    const robot = robotState.get('r1');
    robot.updatedAt = Date.now() - 15000; // 15s ago (> 10s timeout)

    const broadcastMock = jest.fn();
    robotState.sweepStale(broadcastMock);

    const staled = robotState.get('r1');
    expect(staled.isStale).toBe(true);
    expect(staled.status).toBe('offline');
    expect(staled.needsAttention).toBe(true);
    expect(broadcastMock).toHaveBeenCalledWith({
      type: 'update',
      robot: expect.objectContaining({ robot_id: 'r1', status: 'offline', isStale: true }),
    });
  });

  test('reconnected robot restores active state and clears stale flag', () => {
    robotState.upsert({ ...baseEvent, t: 1 });
    const robot = robotState.get('r1');
    robot.updatedAt = Date.now() - 15000;
    robotState.sweepStale();

    expect(robotState.get('r1').isStale).toBe(true);

    // Fresh update arrives with t=2
    const accepted = robotState.upsert({ ...baseEvent, status: 'active', t: 2 });
    expect(accepted).toBe(true);

    const recovered = robotState.get('r1');
    expect(recovered.isStale).toBe(false);
    expect(recovered.status).toBe('active');
  });
});
