module.exports = {
  collectCoverageFrom: [
    'packages/core/src/**/*.{ts,tsx}',
    'backend/src/**/*.{ts,tsx}',
    'frontend/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './packages/core/src/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './backend/src/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './frontend/src/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/?(*.)+(spec|test).{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/'
  ],
  verbose: true,
};
