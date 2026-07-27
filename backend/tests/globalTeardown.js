// Global teardown - runs once after all tests
module.exports = async () => {
  console.log('[Global Teardown] Stopping MongoMemoryServer...');
  if (global.__MONGO_SERVER__) {
    await global.__MONGO_SERVER__.stop();
  }
};