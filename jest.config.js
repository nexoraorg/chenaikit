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
  // Force exit after tests complete — needed because cacheService.ts
  // singletons create a setInterval monitoring timer on import.
  forceExit: true,
};
