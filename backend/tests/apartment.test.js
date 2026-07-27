// Mock cron and services BEFORE importing app
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../src/services/anomaly.service', () => ({ runDetections: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/services/collectionScheduler.service', () => ({ start: jest.fn() }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const BASE = '/api/v1';
let adminToken, landlordId, collectorId;

const adminCreds = { email: 'admin@swcmas.go.ke', password: 'Admin1234!' };

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  const res = await request(app).post(`${BASE}/auth/login`).send(adminCreds);
  adminToken = res.body.data?.token;

  if (adminToken) {
    const usersRes = await request(app)
      .get(`${BASE}/users?role=landlord&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    landlordId = usersRes.body.data?.users?.[0]?._id;

    const collRes = await request(app)
      .get(`${BASE}/users?role=waste_collector&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    collectorId = collRes.body.data?.users?.[0]?._id;
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Apartments', () => {
  test('should return paginated apartments list', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get(`${BASE}/apartments?limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.apartments).toBeInstanceOf(Array);
  });

  test('should require authentication', async () => {
    const res = await request(app).get(`${BASE}/apartments`);
    expect(res.status).toBe(401);
  });

  test('should create a new apartment as admin', async () => {
    if (!adminToken || !landlordId || !collectorId) return;
    const res = await request(app)
      .post(`${BASE}/apartments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Apartment',
        address: '123 Test St',
        city: 'Nairobi',
        county: 'Nairobi',
        location: { type: 'Point', coordinates: [36.8219, -1.2921] },
        unitCount: 10,
        landlord: landlordId,
        wasteCollector: collectorId,
        collectionSchedule: { frequency: 'weekly', days: ['Monday'], time: '08:00' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Apartment');
  });
});