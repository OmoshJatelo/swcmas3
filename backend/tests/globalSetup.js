// Global setup - runs once before all tests
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

module.exports = async () => {
  console.log('[Global Setup] Starting MongoMemoryServer...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  console.log('[Global Setup] MongoMemoryServer URI:', uri);
  process.env.MONGO_URI = uri;
  
  // Store mongoServer globally for teardown
  global.__MONGO_SERVER__ = mongoServer;
  
  // Give MongoDB a moment to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('[Global Setup] MongoDB ready');
};