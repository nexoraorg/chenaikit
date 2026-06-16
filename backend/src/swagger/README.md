# OpenAPI Specification Files

This directory contains supplementary OpenAPI specification files for the ChenAIKit backend.

## How It Works

The primary OpenAPI spec is **auto-generated** from:
1. The base definition in [`../config/swagger.ts`](../config/swagger.ts)
2. `@openapi` JSDoc annotations in route files (`../routes/*.ts`, `../index.ts`)

These are merged at runtime by `swagger-jsdoc`.

## Files

| File | Purpose |
|------|---------|
| `schemas.yaml` | Reusable component schemas (reference copy) |

## Exporting the Spec

- **JSON**: `GET /api-docs.json` (runtime)
- **YAML**: `GET /api-docs.yaml` (runtime)
- **Static file**: Run `npx ts-node scripts/generate-types.ts` to write `../types/openapi-spec.json`
