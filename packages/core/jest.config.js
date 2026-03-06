module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/stellar/__tests__/horizon.test.ts',
    '<rootDir>/src/ai/__tests__/providers.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/examples/**',
    '!src/stellar/__tests__/horizon.test.ts',
    '!src/ai/__tests__/providers.test.ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
