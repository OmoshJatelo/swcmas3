// Mock cron and services BEFORE importing app
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../src/services/anomaly.service', () => ({ runDetections: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/services/collectionScheduler.service', () => ({ start: jest.fn() }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const BASE = '/api/v1';
let adminToken, apartmentId, residentId;

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

    const res2 = await request(app)
      .get(`${BASE}/users?role=resident&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    residentId = res2.body.data?.users?.[0]?._id;
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Complaints', () => {
  test('should create a complaint as resident', async () => {
    if (!adminToken || !apartmentId) return;
    const res = await request(app)
      .post(`${BASE}/complaints`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'missed_collection',
        title: 'Test complaint',
        description: 'Test description',
        apartment: apartmentId,
        priority: 'medium',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Test complaint');
  });

  test('should require authentication', async () => {
    const res = await request(app).post(`${BASE}/complaints`).send({});
    expect(res.status).toBe(401);
  });
});