# Security Guidelines

This document describes baseline security practices for the ChenAIKit codebase, including backend API hardening, secret management, and contract security.

## Backend (API)

### Authentication and Authorization

- Access tokens are JSON Web Tokens (JWT) and must be signed with `ACCESS_TOKEN_SECRET`.
- Refresh tokens are stored server-side as bcrypt hashes; the refresh token returned to the client is formatted as `<id>.<token>`.
- Use short-lived access tokens and rotate refresh tokens where appropriate.

Recommended configuration:

- `ACCESS_TOKEN_EXPIRATION=15m`
- `REFRESH_TOKEN_EXPIRATION=7d`

### Request Validation and Sanitization

- Validate request bodies and params using schema validation (e.g. `zod`).
- Reject invalid input early (400) with consistent error shape.
- Apply basic string trimming/sanitization where applicable.

### Rate Limiting

- Rate limit sensitive endpoints (auth, account creation, API key creation).
- Prefer centralized rate limiting for API keys (tier-based) and per-IP limiting for unauthenticated flows.

### Security Headers

Security headers are applied via `helmet` and centrally configured in `backend/src/middleware/security.ts`.

- CSP defaults to a restrictive policy suitable for JSON APIs.
- `x-powered-by` is disabled.

### CORS

CORS is centrally configured in `backend/src/middleware/security.ts`.

- Configure an allowlist with `CORS_ORIGINS` (comma-separated) for browser clients.
- For local development only, you may set `CORS_ALLOW_ALL=true`.

### SQL Injection Prevention

- Use parameterized queries.
- Prefer Prisma ORM APIs (`findUnique`, `create`, `update`, etc.) over raw SQL.
- Avoid Prisma raw methods (`$queryRawUnsafe`, `$executeRawUnsafe`).

### OWASP Top 10 Coverage (Minimum Bar)

- A01: Broken Access Control
  - Enforce role checks via authorization middleware on privileged routes.
- A02: Cryptographic Failures
  - Never use default production secrets; set `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`.
- A03: Injection
  - Use Prisma parameterization; validate inputs.
- A05: Security Misconfiguration
  - Use centralized security middleware (headers + CORS) and environment validation.
- A07: Identification and Authentication Failures
  - Short-lived access tokens; hashed refresh tokens in DB.
- A09: Security Logging and Monitoring Failures
  - Ensure logs and monitoring are enabled and do not leak secrets.

## Secrets Management

### Environment Variables

- Never commit secrets.
- Use `.env.example` as the canonical list of required/optional variables.

### HashiCorp Vault (Optional)

The backend supports optional secret loading from Vault via `backend/src/config/secrets.ts`.

Required:

- `VAULT_ENABLED=true`
- `VAULT_ADDR=<vault url>`
- `VAULT_TOKEN=<token>`

Optional:

- `VAULT_KV_VERSION=2` (or `1`)
- `VAULT_KV_MOUNT=secret`
- `VAULT_SECRET_PATH=chenaikit/backend`

Vault KV secret data should be a flat map of environment variables (e.g. `ACCESS_TOKEN_SECRET`, `DATABASE_URL`, etc.). Keys are only set if not already present in `process.env`.

## Contracts

The contracts in this repository are Soroban (Rust) contracts.

- Apply the Soroban security model: explicit authorization with `require_auth`, careful storage access patterns, bounded loops, and clear upgrade/admin semantics.
- Use extensive unit tests to cover authorization boundaries and edge cases.

## Penetration Testing Checklist

- API authentication:
  - Verify JWT rejection on invalid signatures, expired tokens, wrong issuer/audience (if configured).
- Authorization:
  - Attempt privilege escalation on admin-only actions.
- Input validation:
  - Fuzz request bodies/params to ensure consistent 4xx responses.
- Rate limiting:
  - Validate per-IP and per-key limits; check headers and `Retry-After`.
- CORS:
  - Confirm browsers cannot call the API from non-allowlisted origins.
- Secrets:
  - Confirm no secrets are logged or returned in API errors.
