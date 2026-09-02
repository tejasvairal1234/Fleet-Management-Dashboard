'use strict';
const request = require('supertest');
const app = require('../src/app');
const robotState = require('../src/state/robotState');
const config = require('../src/config');

describe('Backend API Integration Tests', () => {
  beforeEach(() => {
    robotState.clear();
  });

  const validPayload = {
    robot_id: 'r1',
    robot_type: 'picker',
    x: 200,
    y: 300,
    battery: 95,
    status: 'idle',
    t: 1.0,
  };

  describe('GET /health', () => {
    test('returns 200 with server health status without any database dependency', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.robots).toBe('number');
      expect(typeof res.body.wsClients).toBe('number');
      expect(res.body.mongoConnected).toBeUndefined(); // Verify no MongoDB in health response
    });
  });

  describe('GET /robots & GET /robots/:robotId', () => {
    test('returns empty array when no robots are in memory', async () => {
      const res = await request(app).get('/robots');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns all current robots from in-memory Map', async () => {
      robotState.upsert({ ...validPayload, robot_id: 'r1', t: 1 });
      robotState.upsert({ ...validPayload, robot_id: 'r2', t: 1 });

      const res = await request(app).get('/robots');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    test('returns 404 for non-existent robot', async () => {
      const res = await request(app).get('/robots/unknown_robot');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Robot not found');
    });

    test('returns single robot by ID', async () => {
      robotState.upsert(validPayload);
      const res = await request(app).get('/robots/r1');
      expect(res.status).toBe(200);
      expect(res.body.robot_id).toBe('r1');
      expect(res.body.x).toBe(200);
    });
  });

  describe('POST /ingest', () => {
    test('accepts single valid telemetry payload', async () => {
      const res = await request(app)
        .post('/ingest')
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(robotState.get('r1')).toBeDefined();
    });

    test('rejects invalid schema payload with 400', async () => {
      const res = await request(app)
        .post('/ingest')
        .send({ robot_id: 'r1', x: 999 }); // invalid x > 900

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Update rejected');
      expect(res.body.details).toBeDefined();
    });

    test('rejects out-of-order event with 400', async () => {
      // First event at t=10
      await request(app).post('/ingest').send({ ...validPayload, t: 10 });

      // Late event at t=5 (with valid coordinates)
      const res = await request(app)
        .post('/ingest')
        .send({ ...validPayload, x: 450, t: 5 });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('Out-of-order update rejected');
      expect(robotState.get('r1').x).toBe(200); // not overwritten by late event
    });

    test('handles batch array ingestion', async () => {
      const batch = [
        { ...validPayload, robot_id: 'r1', t: 1 },
        { ...validPayload, robot_id: 'r2', t: 1 },
        { ...validPayload, robot_id: 'r3', t: 1 },
      ];

      const res = await request(app)
        .post('/ingest')
        .send(batch);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(3);
      expect(res.body.total).toBe(3);
      expect(robotState.getAll()).toHaveLength(3);
    });
  });

  describe('Admin Runtime Config Controls', () => {
    test('rejects unauthenticated requests to GET /config with 401', async () => {
      const res = await request(app).get('/config');
      expect(res.status).toBe(401);
    });

    test('rejects unauthenticated requests to POST /config with 401', async () => {
      const res = await request(app).post('/config').send({ fleetSize: 50 });
      expect(res.status).toBe(401);
    });

    test('accepts valid admin token and returns config on GET /config', async () => {
      const res = await request(app)
        .get('/config')
        .set('Authorization', `Bearer ${config.adminToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.fleetSize).toBe('number');
      expect(typeof res.body.updateIntervalMs).toBe('number');
    });

    test('updates runtime config on POST /config with valid admin token', async () => {
      const res = await request(app)
        .post('/config')
        .set('Authorization', `Bearer ${config.adminToken}`)
        .send({ fleetSize: 50, updateIntervalMs: 500 });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(true);
      expect(res.body.config.fleetSize).toBe(50);
      expect(res.body.config.updateIntervalMs).toBe(500);
    });

    test('rejects out-of-range fleetSize or updateIntervalMs on POST /config', async () => {
      const res = await request(app)
        .post('/config')
        .set('Authorization', `Bearer ${config.adminToken}`)
        .send({ fleetSize: 0, updateIntervalMs: 10 }); // out of range

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveLength(2);
    });
  });
});
