module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jsx-a11y'],
  extends: [
    '../.eslintrc.js',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
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
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-console': 'warn',
    'no-case-declarations': 'off',
    'no-undef': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'jsx-a11y/anchor-is-valid': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};
