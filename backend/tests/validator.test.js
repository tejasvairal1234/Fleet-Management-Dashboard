'use strict';
const { validate } = require('../src/ingestion/validator');

describe('Payload Validator', () => {
  const validEvent = {
    robot_id: 'r1',
    robot_type: 'picker',
    x: 150.5,
    y: 220.0,
    battery: 85.5,
    status: 'active',
    t: 10.0,
  };

  test('accepts a valid robot telemetry payload', () => {
    const result = validate(validEvent);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects non-object payload', () => {
    expect(validate(null).valid).toBe(false);
    expect(validate('string').valid).toBe(false);
    expect(validate(123).valid).toBe(false);
  });

  test('rejects missing robot_id', () => {
    const event = { ...validEvent, robot_id: undefined };
    const result = validate(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('robot_id must be a non-empty string');
  });

  test('rejects empty robot_id', () => {
    const event = { ...validEvent, robot_id: '   ' };
    const result = validate(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('robot_id must be a non-empty string');
  });

  test('rejects out-of-bound coordinates', () => {
    expect(validate({ ...validEvent, x: -5 }).valid).toBe(false);
    expect(validate({ ...validEvent, x: 950 }).valid).toBe(false);
    expect(validate({ ...validEvent, y: -1 }).valid).toBe(false);
    expect(validate({ ...validEvent, y: 600 }).valid).toBe(false);
  });

  test('rejects invalid battery percentage', () => {
    expect(validate({ ...validEvent, battery: -1 }).valid).toBe(false);
    expect(validate({ ...validEvent, battery: 101 }).valid).toBe(false);
    expect(validate({ ...validEvent, battery: '85%' }).valid).toBe(false);
  });

  test('rejects invalid status enum values', () => {
    expect(validate({ ...validEvent, status: 'flying' }).valid).toBe(false);
    expect(validate({ ...validEvent, status: 'sleeping' }).valid).toBe(false);
  });

  test('accepts all valid status enum values', () => {
    const statuses = ['idle', 'active', 'on_mission', 'charging', 'blocked', 'error', 'maintenance', 'offline'];
    statuses.forEach((status) => {
      expect(validate({ ...validEvent, status }).valid).toBe(true);
    });
  });

  test('rejects invalid or negative timestamp t', () => {
    expect(validate({ ...validEvent, t: -5 }).valid).toBe(false);
    expect(validate({ ...validEvent, t: '10' }).valid).toBe(false);
    expect(validate({ ...validEvent, t: NaN }).valid).toBe(false);
  });
});
