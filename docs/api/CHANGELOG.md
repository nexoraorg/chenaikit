# API Changelog

All notable, client-facing changes to the ChenAIKit API are documented here.
The API follows [Semantic Versioning](https://semver.org/): breaking changes
ship only in a new major version.

## v2 — 2026-01-01 (current)

### Breaking changes

- **`GET /credit-score`** — response reshaped from a flat object to a nested
  one:
  - `data.score` → `data.creditScore.value`
  - `data.factors` → `data.creditScore.factors` (now objects: `{ name, weight }`)
  - added `data.creditScore.band` and `data.meta` (`generatedAt`, `model`)
  - `data.timestamp` → `data.meta.generatedAt`
- **`GET /fraud/detect`** — response reshaped:
  - `data.riskScore` → `data.fraud.riskScore`
  - `data.riskLevel` → `data.fraud.riskLevel`
  - `data.factors` → `data.fraud.factors` (now objects: `{ name, weight }`)
  - `data.timestamp` → `data.meta.generatedAt`

See the [v1 → v2 migration guide](./migration/v1-to-v2.md).

## v1 — 2025-01-01 (deprecated)

- **Deprecated:** 2026-01-01
- **Sunset:** 2026-12-31

Initial public API. Flat response shapes for `GET /credit-score` and
`GET /fraud/detect`. Accounts, auth, and feature-flag endpoints introduced.

### Migration timeline

| Date       | Event                                                      |
| ---------- | --------------------------------------------------------- |
| 2025-01-01 | v1 released.                                              |
| 2026-01-01 | v2 released; v1 deprecated (deprecation headers emitted). |
| 2026-12-31 | v1 sunset — requests return `410 Gone`.                   |
