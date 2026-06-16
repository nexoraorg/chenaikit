module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    '../../.eslintrc.js',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
  },
  rules: {
    // Core package specific rules
    'no-unused-vars': 'off', // Allow unused vars for blockchain types
    '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars for development
    '@typescript-eslint/no-explicit-any': 'off', // Allow any types for development
    'no-console': 'off', // Allow console statements for development
    'no-prototype-builtins': 'off', // Allow prototype methods
    'no-case-declarations': 'off', // Allow case declarations
  },
};
