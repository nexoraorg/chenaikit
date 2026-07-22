module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    '../.eslintrc.js',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es2021: true,
    jest: true,
    node: true,
  },
  globals: {
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    test: 'readonly',
    jest: 'readonly',
    React: 'readonly',
  },
  rules: {
    // Frontend specific rules
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-console': 'warn',
    'no-case-declarations': 'off',
    'no-undef': 'off', // Allow globals for React and Jest
    '@typescript-eslint/no-explicit-any': 'off', // Allow any types for development
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
