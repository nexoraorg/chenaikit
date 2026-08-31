# chenaikit Backend API

The backend API service for chenaikit, built with Express.js and Prisma.

## Rate Limiting

This API implements rate limiting to protect public routes from request bursts and abuse.

### Route Classification & Limits

| Route Class     | Limit        | Window     | Purpose                              |
| --------------- | ------------ | ---------- | ------------------------------------ |
| Public API      | 100 requests | 15 minutes | Standard API endpoints               |
| Authentication  | 5 attempts   | 15 minutes | Login, register, password reset      |
| Health checks   | Unlimited    | N/A        | `/health` endpoint (monitoring)      |
| Internal routes | Unlimited    | N/A        | `/_internal/*` endpoints (admin/ops) |

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
- `RateLimit-Reset`: Seconds until the current window resets (relative delay)

The JSON response includes `retryAfter` as an epoch-millisecond timestamp for when the client should retry.

Clients should respect `RateLimit-Remaining` and implement exponential backoff when receiving `429` responses.

### Exemptions

The following routes are **not** subject to rate limiting:

- `/health` — used by load balancers and monitoring
- `/_internal/*` — internal operational endpoints

Exemptions are enforced in the middleware layer and do not count against a client's rate limit quota.

## Error Handling

Every response — success or failure — carries an `X-Request-Id` header (set by
`middleware/requestId.ts`, or reused from an inbound `X-Request-Id` header if
one is already set) so a request can be traced end to end.

All errors flow through one centralized handler
(`middleware/errorHandler.ts`, mounted last in `src/index.ts`) so clients get
one consistent response shape regardless of what failed:

```json
{
  "error": "not_found",
  "message": "The requested resource was not found.",
  "requestId": "b2b1a6e0-..."
}
```

`error` is a stable, machine-readable code — safe for clients to branch on.
`message` is safe to display as-is. An error can optionally include a
`details` object with safe, structured extra context (e.g. which field
failed validation).

### Known errors

Route handlers signal an expected failure by throwing one of the typed
errors from `src/errors/`:

| Class               | Status | `error` code       |
| -------------------- | ------ | ------------------- |
| `ValidationError`    | 400    | `validation_error`  |
| `UnauthorizedError`  | 401    | `unauthorized`      |
| `ForbiddenError`     | 403    | `forbidden`          |
| `NotFoundError`      | 404    | `not_found`          |
| `ConflictError`      | 409    | `conflict`            |
| `DatabaseError`      | 500    | `database_error`    |

A request to a route that doesn't exist gets the same `not_found` shape
(`middleware/notFoundHandler.ts`) instead of Express's default HTML 404 page.

Known Prisma errors are mapped automatically (`errors/mapPrismaError.ts`) so
a route doesn't need its own try/catch for common database failures — a
unique constraint violation becomes a 409 `conflict`, a missing record
becomes a 404 `not_found`, a foreign key violation becomes a 400
`validation_error`, and anything else recognisably-Prisma-but-unmapped
becomes a generic 500 `database_error`. The raw Prisma error message (which
can include table/column names and query fragments) is never sent to the
client — only logged server-side.

### Unexpected errors

Anything that isn't a known error type is treated as unexpected: the client
gets a generic `500 internal_error` with a `requestId`, and the **full**
error — including its stack trace — is logged server-side only
(`console.error` by default; inject a different sink via
`createErrorHandler({ log })`). Stack traces never appear in a response
body.

### Writing an async route handler

Express 4 doesn't catch a rejected promise from an async route handler on
its own — wrap it in `asyncHandler` so a thrown/rejected error reaches the
centralized handler instead of crashing the process:

```ts
import { asyncHandler } from "./middleware/asyncHandler.js";
import { NotFoundError } from "./errors/index.js";

app.get(
  "/creators/:id",
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUniqueOrThrow({ where: { id: req.params.id } });
    // ...or throw a typed error explicitly:
    // if (!creator) throw new NotFoundError("No creator with that id.");
    res.json(creator);
  }),
);
```

A synchronous `throw` in a non-async handler doesn't need `asyncHandler` —
Express already catches those.

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

## Graceful shutdown

The process listens for `SIGTERM` (sent by orchestrators like Kubernetes and
most PaaS platforms during a deploy) and `SIGINT` (Ctrl+C locally) and runs a
shutdown sequence instead of dying mid-request:

1. The HTTP server stops accepting **new** connections while letting
   in-flight requests finish (`server.close()`).
2. The Prisma database connection is closed (`prisma.$disconnect()`).
3. The process exits `0`.

If the sequence doesn't complete within the timeout, the process force-exits
with code `1` instead of hanging — resources are always closed, but never
more than once. Configure the timeout with:

```bash
# Milliseconds to wait before forcing an exit. Defaults to 10000 (10s).
SHUTDOWN_TIMEOUT_MS=15000
```

The sequencing logic lives in `src/lifecycle.ts` and is covered by
`src/lifecycle.test.ts`; `src/index.ts` only wires it to the real server,
Prisma client, and OS signals.
