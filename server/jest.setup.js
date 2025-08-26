const path = require('path');

// Load environment variables for testing
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_please_override';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Set global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods during tests
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'patient',
  isActive: true,
  isTwoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

global.createMockResult = (overrides = {}) => ({
  id: 'test-result-id',
  patientNumber: 'P12345',
  patientName: 'Test Patient',
  testDate: new Date(),
  status: 'completed',
  results: [
    {
      testCode: 'TEST001',
      testName: 'Test',
      value: '100',
      unit: 'mg/dl',
      referenceRange: '70-110'
    }
  ],
  ...overrides
});

// Mock external dependencies
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    DailyRotateFile: jest.fn()
  }
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Add custom matchers
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toBeValidBSNR(received) {
    const bsnrRegex = /^\d{9}$/;
    const pass = bsnrRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid BSNR`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid BSNR`,
        pass: false,
      };
    }
  },
  
  toBeValidLANR(received) {
    const lanrRegex = /^\d{9}$/;
    const pass = lanrRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid LANR`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid LANR`,
        pass: false,
      };
    }
  },
  
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  }
});