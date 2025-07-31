// Test setup file
require('dotenv').config({ path: '.env.test' })

// Global test timeout
jest.setTimeout(30000)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    password: 'TestPassword123!',
    role: 'doctor',
    permissions: ['view_results', 'download_results'],
    ...overrides,
  }),

  generateTestResult: (overrides = {}) => ({
    id: 'test-result-id',
    patient: 'John Doe',
    type: 'Blood Test',
    status: 'Final',
    date: new Date().toISOString(),
    assignedTo: 'doctor@example.com',
    ...overrides,
  }),

  // Mock JWT token
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken')
    const defaultPayload = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'doctor',
      ...payload,
    }
    return jwt.sign(defaultPayload, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h',
    })
  },

  // Clean up function
  cleanup: async () => {
    // Add any cleanup logic here
    jest.clearAllMocks()
  },
}

// Setup and teardown
beforeEach(async () => {
  // Reset mocks before each test
  jest.clearAllMocks()
})

afterEach(async () => {
  // Cleanup after each test
  await global.testUtils.cleanup()
})

afterAll(async () => {
  // Final cleanup
  jest.restoreAllMocks()
})