module.exports = {
  projects: [
    '<rootDir>/packages/core/jest.config.js',
    '<rootDir>/packages/cli/jest.config.js',
    '<rootDir>/backend/jest.config.js',
    '<rootDir>/frontend/jest.config.js',
  ],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
};
