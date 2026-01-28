/** @type {import('jest').Config} */
export default {
  // Use Node environment for Puppeteer (not JSDOM)
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*integration*/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  // Don't use the standard setup file - integration tests don't need Chrome mocks
  setupFilesAfterEnv: [],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  // Longer timeout for browser tests
  testTimeout: 60000,
  verbose: true,
  // Run tests serially to avoid browser conflicts
  maxWorkers: 1,
};
