# chenaikit Backend API

The backend API service for chenaikit, built with Express.js and Prisma.

## Rate Limiting

This API implements rate limiting to protect public routes from request bursts and abuse.

### Route Classification & Limits

| Route Class | Limit | Window | Purpose |
|-----------|-------|--------|---------|
| Public API | 100 requests | 15 minutes | Standard API endpoints |
| Authentication | 5 attempts | 15 minutes | Login, register, password reset |
| Health checks | Unlimited | N/A | `/health` endpoint (monitoring) |
| Internal routes | Unlimited | N/A | `/_internal/*` endpoints (admin/ops) |

### Rate Limit Responses

When a request exceeds its limit, the API responds with HTTP `429 (Too Many Requests)`:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please retry after some time.",
  "retryAfter": 1692345678000
}
```

### Retry Guidance

The API includes standard rate limit headers in every response:

- `RateLimit-Limit`: Total requests allowed in the window
- `RateLimit-Remaining`: Requests remaining in the current window
- `RateLimit-Reset`: Unix timestamp when the limit window resets

Clients should respect `RateLimit-Remaining` and implement exponential backoff when receiving `429` responses.

### Exemptions

The following routes are **not** subject to rate limiting:

- `/health` — used by load balancers and monitoring
- `/_internal/*` — internal operational endpoints

Exemptions are enforced in the middleware layer and do not count against a client's rate limit quota.

## Development

### Setup

```bash
pnpm install
pnpm build
pnpm test
```

### Running the server

```bash
# Development (with watch)
pnpm run dev

# Production
pnpm run build
pnpm run start
```

### Testing

```bash
# Run all tests
pnpm run test

# Run with UI
pnpm run test --ui
```

## Deployment

Rate limiting is configured with in-memory storage by default, suitable for single-instance deployments. For distributed deployments, implement a shared store (Redis, Memcached) by modifying `middleware/rateLimiter.ts` to use `express-rate-limit` with an appropriate store.
