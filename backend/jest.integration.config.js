/**
 * Jest configuration for integration tests.
 *
 * Matches:
 *   src/__tests__/integration/*.integration.test.ts
 *   src/__tests__/api/*.api.test.ts
 *
 * Uses:
 *   - jest.integration.setup.js  (plain JS, sets env vars before ts-jest loads)
 *   - src/__tests__/setup.ts     (TypeScript, pushes DB schema, registers global hooks)
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],

  testMatch: [
    '**/__tests__/integration/**/*.integration.test.ts',
    '**/__tests__/api/**/*.api.test.ts',
  ],

  // Plain-JS setup runs first (env vars before any module is imported)
  setupFiles: ['<rootDir>/jest.integration.setup.js'],

  // TypeScript setup runs after Jest framework is installed in the environment
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // ts-jest handles TypeScript transpilation
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: false, // skip type-checking in test runs for speed
      },
    ],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/generated/**',
    '!src/database/migrations/**',
  ],

  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  clearMocks: true,
  restoreMocks: true,

  // Generous timeout for DB setup + HTTP round-trips
  testTimeout: 30000,

  // Force sequential execution to avoid SQLite write contention
  maxWorkers: 1,

  // Force Jest to exit after all tests finish (prevents open-handle hangs
  // from Redis connections, Prisma keep-alive, etc.)
  forceExit: true,
};
