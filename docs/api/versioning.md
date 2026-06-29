# API Versioning

The ChenAIKit backend API is versioned to support backward compatibility and
controlled evolution. This document describes the versioning strategy, the
supported versions, and the deprecation/sunset policy.

## Versioning strategies

Clients may select a version using any of the following (resolved in this order
of precedence):

| Strategy        | Example                                           |
| --------------- | ------------------------------------------------- |
| URL path        | `GET /api/v2/credit-score`                        |
| Header          | `GET /api/credit-score` + `Accept-Version: v2`    |
| Query parameter | `GET /api/credit-score?version=v2`                |
| Default         | `GET /api/credit-score` (resolves to the default) |

Accepted version formats are flexible: `v2`, `V2`, `2`, and `2.0.0` all resolve
to `v2`. For query versioning, `version`, `api-version`, and `v` are all
accepted parameter names.

If a client requests an **explicit but unsupported** version, the API responds
with `400 UNSUPPORTED_API_VERSION` and lists the supported versions.

## Supported versions

| Version | Semver | Status     | Released   | Deprecated | Sunset     |
| ------- | ------ | ---------- | ---------- | ---------- | ---------- |
| `v1`    | 1.0.0  | deprecated | 2025-01-01 | 2026-01-01 | 2026-12-31 |
| `v2`    | 2.0.0  | active     | 2026-01-01 | —          | —          |

- **Default version:** `v1` (keeps existing, unversioned clients working).
- **Latest version:** `v2`.

The live registry is available at `GET /api/versions`.

## Response headers

Every response carries version metadata:

| Header                 | Meaning                                            |
| ---------------------- | -------------------------------------------------- |
| `X-API-Version`        | The version that served the request.               |
| `X-API-Version-Latest` | The newest available version.                      |
| `Deprecation`          | (Deprecated versions) RFC 8594 deprecation date.   |
| `Sunset`               | (Versions with a sunset) RFC 8594 retirement date. |
| `Warning`              | (Deprecated versions) human-readable warning.      |
| `Link`                 | (Deprecated versions) link to the migration guide. |

## Deprecation & sunset policy

1. **Active** — the version is fully supported and receives new features.
2. **Deprecated** — the version still works but is scheduled for removal.
   Responses include `Deprecation`, `Sunset`, `Warning`, and `Link` headers, and
   each request is logged. Deprecation is announced at least **12 months** before
   sunset.
3. **Sunset** — once the sunset date passes, the version stops serving traffic
   and returns `410 API_VERSION_SUNSET` with a pointer to the successor version
   and migration guide.

Breaking changes are only introduced in a **new major version**. Within a
version, changes are additive and backward compatible (semantic versioning).

## Adding a new version

1. Add an entry to `API_VERSIONS` in `backend/src/utils/versionUtils.ts`
   (set `status`, dates, `successor`, `docsUrl`) and update `LATEST_VERSION`.
2. Create `backend/src/routes/v{n}/index.ts` and register it in the version
   dispatcher in `backend/src/index.ts`.
3. Reuse canonical models from `backend/src/routes/shared/` and add a version
   transform there (the compatibility layer).
4. Document changes in `CHANGELOG.md` and add a migration guide under
   `docs/api/migration/`.

## Version-specific middleware

Each version router is an independent Express router, so version-specific
middleware can be attached per version. The `requireVersion(...)` guard
(`backend/src/middleware/versioning.ts`) restricts an endpoint to specific
versions, returning `404 ENDPOINT_NOT_IN_VERSION` otherwise.

## See also

- [CHANGELOG](./CHANGELOG.md)
- [v1 → v2 migration guide](./migration/v1-to-v2.md)
