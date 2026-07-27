module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupMocks.js'],
  setupFilesAfterEnvironment: ['<rootDir>/tests/setupAfterEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
};