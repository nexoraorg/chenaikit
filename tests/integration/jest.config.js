module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.d.ts', '!**/node_modules/**'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/helpers/setup.ts']
};
