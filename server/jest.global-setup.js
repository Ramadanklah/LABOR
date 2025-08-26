const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  console.log('Setting up test environment...');
  
  // Load test environment variables
  require('dotenv').config({ 
    path: path.resolve(__dirname, '../.env') 
  });
  
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // Use random port for tests
  process.env.LOG_LEVEL = 'error'; // Reduce log noise
  
  // Check if test database is available (optional)
  try {
    // You could add database connection tests here
    console.log('Test environment setup complete');
  } catch (error) {
    console.warn('Test database not available, using mocks:', error.message);
  }
  
  // Note: jest.setTimeout should be set in individual test files or jest.setup.js
  // jest.setTimeout(30000);
};