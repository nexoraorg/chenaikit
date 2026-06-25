module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@chenaikit/(.*)$': '<rootDir>/../packages/core/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/index.tsx',
    '!src/setupTests.ts',
    '!src/react-app-env.d.ts',
    '!src/themes/**',
    '!src/i18n/**',
    '!src/locales/**',
    '!src/components/WebSocketProvider.tsx',
    '!src/components/DataVisualizationExample.tsx',
    '!src/components/FormValidationExample.tsx',
    '!src/components/NetworkTopologyView.tsx',
    '!src/components/TransactionFlowChart.tsx',
    '!src/components/UserActivityHeatmap.tsx',
    '!src/components/PerformanceDashboard.tsx',
    '!src/components/PerformanceMetricsChart.tsx',
    '!src/components/FraudDetection.tsx',
    '!src/App.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
};
