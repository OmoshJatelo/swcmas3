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
  // Login as admin (assumes seed data has been run or admin exists)
  const res = await request(app).post(`${BASE}/auth/login`).send(adminCreds);
  adminToken = res.body.data?.token;

  // Get a landlord and collector ID from existing users
  if (adminToken) {
    const usersRes = await request(app)
      .get(`${BASE}/users?role=landlord&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    landlordId = usersRes.body.data?.users?.[0]?._id;

    const collectorsRes = await request(app)
      .get(`${BASE}/users?role=waste_collector&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    collectorId = collectorsRes.body.data?.users?.[0]?._id;
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Apartments — GET /apartments', () => {
  it('should return paginated apartments list', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get(`${BASE}/apartments?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.apartments)).toBe(true);
    expect(res.body.data).toHaveProperty('total');
  });

  it('should require authentication', async () => {
    const res = await request(app).get(`${BASE}/apartments`);
    expect(res.status).toBe(401);
  });
});

describe('Apartments — POST /apartments', () => {
  let createdId;

  it('should create a new apartment as admin', async () => {
    if (!adminToken || !landlordId) {
      console.warn('Skipping: missing adminToken or landlordId');
      return;
    }

    const res = await request(app)
      .post(`${BASE}/apartments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Apartment Suite',
        address: '123 Test Street',
        city: 'Nairobi',
        county: 'Nairobi',
        unitCount: 10,
        location: { type: 'Point', coordinates: [36.82, -1.29] },
        landlord: landlordId,
        wasteCollector: collectorId,
        collectionSchedule: { frequency: 'daily', time: '08:00' },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.name).toBe('Test Apartment Suite');
    createdId = res.body.data._id;
  });

  it('should reject creation without required fields', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post(`${BASE}/apartments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete Apartment' });
    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    // Cleanup created test apartment
    if (adminToken && createdId) {
      await request(app)
        .delete(`${BASE}/apartments/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });
});

describe('Apartments — GET /apartments/:id', () => {
  it('should return a single apartment by ID', async () => {
    if (!adminToken) return;
    const listRes = await request(app)
      .get(`${BASE}/apartments?limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    const firstId = listRes.body.data?.apartments?.[0]?._id;
    if (!firstId) return;

    const res = await request(app)
      .get(`${BASE}/apartments/${firstId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(firstId);
  });

  it('should return 404 for non-existent ID', async () => {
    if (!adminToken) return;
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`${BASE}/apartments/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
//to add direct mapping for easier addition of apartments//
