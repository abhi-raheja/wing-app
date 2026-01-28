/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/__mocks__/setup.js'],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 10000,
  verbose: true,
  injectGlobals: true,
  collectCoverageFrom: [
    'lib/**/*.js',
    'popup/**/*.js',
    'options/**/*.js',
    'background.js',
    'content.js',
    '!**/__mocks__/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Use fake timers by default
  fakeTimers: {
    enableGlobally: false,
  },
  // Global setup for ESM
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
