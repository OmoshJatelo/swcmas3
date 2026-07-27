// Test setup — in-memory MongoDB using mongodb-memory-server
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Use a mock DB URL for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-swcmas-2024';
process.env.JWT_EXPIRES_IN = '1d';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock cron and scheduler services to prevent open handles
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));
jest.mock('../src/services/anomaly.service', () => ({
  runDetections: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/services/collectionScheduler.service', () => ({
  start: jest.fn(),
}));

// Mock mailer to prevent SMTP connections
jest.mock('../src/utils/mailer', () => ({
  verify: jest.fn((cb) => cb(null, true)),
}));

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Stop in-memory MongoDB after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});