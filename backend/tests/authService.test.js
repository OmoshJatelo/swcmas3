const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authService = require('../src/services/auth.service');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth Service Direct Test', () => {
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'testservice@example.com',
    password: 'Password123!',
    role: 'resident',
  };

  afterAll(async () => {
    await User.deleteMany({ email: testUser.email });
  });

  test('should register user and save refreshToken', async () => {
    const result = await authService.register(testUser);
    console.log('Register result:', JSON.stringify(result, null, 2));
    
    const user = await User.findOne({ email: testUser.email }).select('+refreshToken');
    console.log('User after register:', user.refreshToken);
    expect(user.refreshToken).toBeDefined();
  });

  test('should login and save refreshToken', async () => {
    const result = await authService.login(testUser.email, testUser.password);
    console.log('Login result:', JSON.stringify(result, null, 2));
    
    const user = await User.findOne({ email: testUser.email }).select('+refreshToken');
    console.log('User after login:', user.refreshToken);
    expect(user.refreshToken).toBeDefined();
  });

  test('should refresh access token', async () => {
    // Login again to get a fresh refresh token
    const loginResult = await authService.login('testservice@example.com', 'Password123!');
    const refreshToken = loginResult.refreshToken;
    console.log('Refresh token from login:', refreshToken);
    
    const result = await authService.refresh(refreshToken);
    console.log('Refresh result:', JSON.stringify(result, null, 2));
    expect(result.accessToken).toBeDefined();
  });
});