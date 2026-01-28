/**
 * Jest Test Setup
 * Initializes mocks and global test utilities
 */

import { jest } from '@jest/globals';
import chromeMock from './chrome.js';
import indexedDBMock, { MockIDBKeyRange } from './indexedDB.js';

// Set up global Chrome API mock
global.chrome = chromeMock;

// Set up IndexedDB mock
global.indexedDB = indexedDBMock;
global.IDBKeyRange = MockIDBKeyRange;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  get: () => true,
  configurable: true
});

// Mock fetch for API tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      content: [{ text: 'Mock summary response' }],
      usage: { input_tokens: 100, output_tokens: 50 }
    })
  })
);

// Mock AbortController
global.AbortController = class {
  constructor() {
    this.signal = { aborted: false };
  }
  abort() {
    this.signal.aborted = true;
  }
};

// Test utilities
global.testUtils = {
  // Wait for all pending promises/timeouts
  flushPromises: () => new Promise(resolve => setTimeout(resolve, 0)),

  // Create a mock wing
  createMockWing: (overrides = {}) => ({
    id: `wing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    url: 'https://example.com/test-page',
    title: 'Test Page Title',
    favicon: 'https://example.com/favicon.ico',
    summary: 'This is a test summary of the page content.',
    fullContent: 'Full page content here...',
    collectionIds: [],
    nestIds: [],
    timestamp: Date.now(),
    ...overrides
  }),

  // Create a mock collection
  createMockCollection: (overrides = {}) => ({
    id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Collection',
    description: 'A test collection',
    color: '#1a73e8',
    createdAt: Date.now(),
    ...overrides
  }),

  // Create a mock nest
  createMockNest: (overrides = {}) => ({
    id: `nest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Nest',
    collectionId: null,
    parentId: null,
    createdAt: Date.now(),
    ...overrides
  }),

  // Create a mock highlight
  createMockHighlight: (overrides = {}) => ({
    id: `hl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    wingId: null,
    selectedText: 'This is highlighted text',
    annotation: 'Test annotation',
    xpath: '/html/body/p[1]/text()[1]',
    startOffset: 0,
    endOffset: 25,
    timestamp: Date.now(),
    ...overrides
  }),

  // Create a mock connection
  createMockConnection: (overrides = {}) => ({
    id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    wingId1: null,
    wingId2: null,
    score: 0.75,
    type: 'semantic',
    analyzedAt: Date.now(),
    ...overrides
  }),

  // Set mock API responses
  mockApiResponse: (response) => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response)
      })
    );
  },

  // Set mock API error
  mockApiError: (status, error) => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status,
        json: () => Promise.resolve({ error: { message: error } })
      })
    );
  },

  // Reset all mocks between tests
  resetAllMocks: () => {
    chromeMock._resetAll();
    indexedDBMock._clearAll();
    if (global.fetch && typeof global.fetch.mockClear === 'function') {
      global.fetch.mockClear();
    }
  }
};

// Reset mocks before each test
beforeEach(() => {
  global.testUtils.resetAllMocks();
});

// Console error/warn suppression for expected test errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Suppress expected errors in tests
    const msg = args[0]?.toString?.() || '';
    if (msg.includes('Wing') || msg.includes('test') || msg.includes('Error')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args) => {
    const msg = args[0]?.toString?.() || '';
    if (msg.includes('Wing') || msg.includes('test')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
