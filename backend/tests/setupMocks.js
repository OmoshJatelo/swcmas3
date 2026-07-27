// Mock cron and services to prevent open handles - runs BEFORE test framework
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

// Mock database connection to prevent real MongoDB connection
jest.mock('../src/config/database', () => {
  const mockConnectDB = jest.fn().mockResolvedValue({ connection: { host: 'localhost', name: 'test' } });
  return {
    __esModule: true,
    default: mockConnectDB,
    connectDB: mockConnectDB,
  };
});