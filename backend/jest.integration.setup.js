/**
 * Jest integration test bootstrap (JavaScript, loaded by Jest before ts-jest).
 *
 * Sets environment variables so they are available when modules are first
 * imported (before any TypeScript setup file runs).  Heavy lifecycle work
 * (DB push, prisma connect) lives in src/__tests__/setup.ts which runs
 * after the framework is initialised.
 */

process.env.NODE_ENV = 'test';

// Prevent Sentry / OpenTelemetry from initialising in tests
delete process.env.SENTRY_DSN;
delete process.env.OTEL_ENABLED;

// Use SQLite in-process – the actual path is finalised in setup.ts
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/test.db';

// JWT secrets for the test environment
process.env.ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'integration_test_access_secret';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'integration_test_refresh_secret';

// Suppress noisy log output from the application
process.env.LOG_LEVEL = 'error';

// Point Redis at localhost — AdvancedRateLimiter bypasses Redis in NODE_ENV=test
// so a real Redis connection is not required; the client just needs to not crash.
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Set generous timeout (also set in jest config, but belt-and-suspenders)
jest.setTimeout(30000);
