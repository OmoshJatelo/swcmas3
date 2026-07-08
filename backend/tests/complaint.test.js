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

describe('Complaints — GET /complaints', () => {
  it('should return paginated complaints list', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get(`${BASE}/complaints?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.complaints)).toBe(true);
  });
});

describe('Complaints — POST /complaints', () => {
  let createdId;

  it('should file a new complaint', async () => {
    if (!adminToken || !apartmentId) {
      console.warn('Skipping test due to missing IDs');
      return;
    }

    const res = await request(app)
      .post(`${BASE}/complaints`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Missed Waste Collection',
        description: 'The collector did not show up this week as scheduled.',
        type: 'missed_collection',
        apartment: apartmentId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.status).toBe('pending');
    createdId = res.body.data._id;
  });

  afterAll(async () => {
    if (adminToken && createdId) {
      await request(app)
        .delete(`${BASE}/complaints/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });
});
//add ai priority sorting for the complaints//
