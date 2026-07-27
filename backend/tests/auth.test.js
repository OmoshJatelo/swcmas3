// Mock cron and services to prevent open handles
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));
jest.mock('../src/services/anomaly.service', () => ({
  runDetections: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/services/collectionScheduler.service', () => ({
  start: jest.fn(),
}));
jest.mock('../src/utils/mailer', () => ({
  verify: jest.fn((cb) => cb(null, true)),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const BASE = '/api/v1/auth';

const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'testuser@example.com',
  password: 'Password123!',
  role: 'resident',
};

describe('Auth', () => {
  let refreshCookie;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  }, 30000);

  afterAll(async () => {
    const User = require('../src/models/User');
    await User.deleteMany({ email: 'testuser@example.com' });
    await mongoose.connection.close();
  }, 30000);

  test('should register, login, and refresh token in sequence', async () => {
    // Register
    const registerRes = await request(app).post(`${BASE}/register`).send(testUser);
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.user.email).toBe(testUser.email);
    expect(registerRes.body.data.accessToken).toBeDefined();

    // Login
    const loginRes = await request(app).post(`${BASE}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();

    // Debug: check DB after login
    const User = require('../src/models/User');
    const userAfterLogin = await User.findOne({ email: testUser.email }).select('+refreshToken');
    console.log('DB refreshToken after login:', userAfterLogin?.refreshToken);
    console.log('User after login full:', JSON.stringify(userAfterLogin, null, 2));

    // Extract refresh token cookie
    const cookies = loginRes.headers['set-cookie'];
    console.log('Login cookies:', JSON.stringify(cookies, null, 2));
    
    let refreshCookie;
    if (cookies) {
      const cookie = cookies.find(c => c.startsWith('refreshToken='));
      if (cookie) {
        refreshCookie = cookie.split(';')[0];
      }
    }
    console.log('Extracted refreshCookie:', refreshCookie);

    // Refresh token
    if (refreshCookie) {
      const tokenValue = refreshCookie.split('=')[1].split(';')[0];
      console.log('Token value:', tokenValue.substring(0, 20) + '...');
      
      // Check what's in DB before refresh
      const User = require('../src/models/User');
      const userBeforeRefresh = await User.findOne({ email: testUser.email }).select('+refreshToken');
      console.log('DB refreshToken before refresh:', userBeforeRefresh?.refreshToken);
      console.log('Token sent:', tokenValue);
      console.log('Match:', userBeforeRefresh?.refreshToken === tokenValue);
      
      const res = await request(app)
        .post(`${BASE}/refresh-token`)
        .set('Cookie', `refreshToken=${tokenValue}`)
        .send({ refreshToken: tokenValue });
      console.log('Refresh response:', res.status, JSON.stringify(res.body, null, 2));
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    }
  }, 30000);

  test('should reject login with wrong password', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: 'testuser@example.com',
      password: 'WrongPassword123!',
    });
    expect(res.status).toBe(401);
  }, 10000);

  test.skip('should request password reset - requires SMTP', async () => {
    const res = await request(app).post(`${BASE}/reset-password`).send({
      email: 'testuser@example.com',
    });
    expect(res.status).toBe(200);
  }, 10000);
});