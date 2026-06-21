module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-console': 'warn',
  },
  overrides: [
    {
      // CLI commands and entry point intentionally use console for user-facing output
      files: ['src/commands/**/*.ts', 'src/index.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/__tests__/**', '**/*.test.ts'],
      env: {
        jest: true,
      },
      rules: {
        'no-undef': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};