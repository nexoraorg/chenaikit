module.exports = {

  extends: ['../../.eslintrc.js'],
  rules: {
    // Core package specific rules
    'no-unused-vars': 'off', // Allow unused vars for blockchain types

  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,

  },
};
