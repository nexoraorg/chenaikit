# Integration Test Suite

Cross-package integration tests for the `chenaikit` repository.

## Overview

This package (`@chenaikit/integration-tests`) provides a reproducible, isolated integration test harness for testing the backend API without affecting local developer databases or requiring production credentials.

## Setup & Strategy

- **Database Isolation**: The integration test harness (`harness.ts`) creates and manages an isolated test SQLite database (`test-integration.db`).
- **Schema Management**: Before tests execute, the harness applies the backend Prisma schema using `prisma db push --skip-generate`.
- **Environment Variables**:
  - `NODE_ENV`: Set to `test`.
  - `DATABASE_URL`: Automatically configured by `harness.ts` to `file:./test-integration.db`.
- **Teardown**: On completion, the test database and journal files are automatically unlinked and cleaned up.

## Running Tests

From the repository root:

```bash
pnpm test:integration
```

Or within the `tests/integration` directory:

```bash
cd tests/integration
pnpm test
```

## Coverage

The test suite (`backend-api.test.ts`) verifies representative API flows:
- **2xx Success**: Health check (`GET /health`) and record creation/querying (`GET /api/records`, `POST /api/records`).
- **4xx Validation Error**: Invalid inputs on record creation (`POST /api/records`).
- **5xx Persistence / Server Error**: Diagnostic context output on simulated errors (`GET /api/trigger-error`).
