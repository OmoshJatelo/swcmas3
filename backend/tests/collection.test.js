// Mock cron and services BEFORE importing app
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../src/services/anomaly.service', () => ({ runDetections: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/services/collectionScheduler.service', () => ({ start: jest.fn() }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const BASE = '/api/v1';
let adminToken, apartmentId, collectorId;

const adminCreds = { email: 'admin@swcmas.go.ke', password: 'Admin1234!' };

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  const res = await request(app).post(`${BASE}/auth/login`).send(adminCreds);
  adminToken = res.body.data?.token;

  if (adminToken) {
    const aptRes = await request(app)
      .get(`${BASE}/apartments?limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    apartmentId = aptRes.body.data?.apartments?.[0]?._id;

    const collectorsRes = await request(app)
      .get(`${BASE}/users?role=waste_collector&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    collectorId = collectorsRes.body.data?.users?.[0]?._id;
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Collections', () => {
  test('should create a collection schedule as admin', async () => {
    if (!adminToken || !apartmentId || !collectorId) return;
    const res = await request(app)
      .post(`${BASE}/collections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apartment: apartmentId,
        wasteCollector: collectorId,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.data.apartment).toBe(apartmentId);
  });

  test('should require authentication', async () => {
    const res = await request(app).post(`${BASE}/collections`).send({});
    expect(res.status).toBe(401);
  });
});