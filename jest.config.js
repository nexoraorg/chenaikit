module.exports = {
  projects: [
    '<rootDir>/packages/core/jest.config.js',
    '<rootDir>/packages/cli/jest.config.js',
    '<rootDir>/backend/jest.config.js',
  ],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 45,
      lines: 55,
      statements: 55,
    },
  },
};
