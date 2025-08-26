// Jest setup for React components testing
import '@testing-library/jest-dom';

// Mock API client
jest.mock('./utils/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  defaults: {
    headers: {
      common: {}
    }
  }
}));

// Mock performance utilities
jest.mock('./utils/performance', () => ({
  startPageLoad: jest.fn(),
  endPageLoad: jest.fn(),
  trackEvent: jest.fn(),
  measureComponent: jest.fn()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
global.File = class File {
  constructor(chunks, filename, options = {}) {
    this.chunks = chunks;
    this.name = filename;
    this.type = options.type || '';
    this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
};

global.FileReader = class FileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = file.chunks.join('');
      if (this.onload) this.onload();
    }, 0);
  }
  
  readAsDataURL(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = `data:${file.type};base64,${btoa(file.chunks.join(''))}`;
      if (this.onload) this.onload();
    }, 0);
  }
};

// Custom matchers
expect.extend({
  toBeVisible(received) {
    const pass = received && received.style.display !== 'none' && received.style.visibility !== 'hidden';
    if (pass) {
      return {
        message: () => `expected element not to be visible`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to be visible`,
        pass: false,
      };
    }
  },
  
  toHaveValue(received, expected) {
    const pass = received && received.value === expected;
    if (pass) {
      return {
        message: () => `expected element not to have value ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to have value ${expected}, got ${received?.value}`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.createMockEvent = (type, properties = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
};

global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'patient',
  isActive: true,
  isTwoFactorEnabled: false,
  ...overrides
});

global.createMockApiResponse = (data, success = true) => ({
  data: {
    success,
    ...data
  },
  status: success ? 200 : 400,
  statusText: success ? 'OK' : 'Bad Request'
});

// Console suppression for tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
       args[0].includes('componentWillUpdate'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});