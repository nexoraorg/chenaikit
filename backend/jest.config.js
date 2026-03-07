module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/models.test.ts',
    '<rootDir>/src/__tests__/accounts.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/models.test.ts',
    '!src/**/__tests__/accounts.test.ts'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
};
