Database Optimization Plan

Summary
- Provider: SQLite for development; consider PostgreSQL for production scale.
- Goals: improve read performance, add relational integrity, enable search, document ops.

Schema Enhancements
- Timestamps: All models now include updatedAt; soft deletes via deletedAt where useful.
- Relationships: Enforced explicit relations with onDelete handling at schema level.
- Indices:
  - User: createdAt
  - RefreshToken: (userId, expiresAt)
  - ApiKey: (userId, isActive), expiresAt, lastUsedAt
  - ApiUsage: (apiKeyId, timestamp), (endpoint, timestamp), (statusCode, timestamp), (ip, timestamp)
- Full‑Text Search (SQLite FTS5):
  - Virtual table api_usage_fts indexes endpoint, userAgent, ip
  - Triggers keep FTS in sync on insert/update/delete

Common Query Patterns
- ApiUsage time‑series by key: filter by apiKeyId and timestamp range; order by timestamp DESC; select minimal columns.
- ApiKey management: filter by userId and isActive; prefer keyHash unique lookups for rate‑limiting.
- Token cleanup: prune RefreshToken where expiresAt < now() using the composite index.
- Soft delete filtering: add deletedAt IS NULL to read queries when applicable.

Migrations
- Migration folder 20260309090000_db_optimizations adds columns, indices, and FTS objects.
- For dev: use npx prisma migrate dev or pnpm --filter @chenaikit/backend prisma:migrate.
- For CI: use prisma migrate deploy to apply without creating new migrations.

Seeding
- Seed script at prisma/seed.ts creates an admin user, a default API key, and sample usage logs.
- Configure via package.json prisma.seed and run: pnpm --filter @chenaikit/backend prisma:seed.

Backups
- SQLite: copy the database file while ensuring no open writes; or run VACUUM INTO 'backup.db' for a consistent snapshot.
- Schedule periodic backups; store off‑host; rotate with retention policy.
- For cloud/production with PostgreSQL: use pg_dump with PITR and WAL archiving.

Future Scale Considerations
- PostgreSQL:
  - Partition large ApiUsage by month on timestamp
  - Add GIN index for full‑text search on (endpoint, userAgent, ip) with to_tsvector
  - Materialized views for aggregated usage metrics
- Observability: track slow queries; add covering indices if read patterns evolve.

Operational Notes
- Regenerate Prisma client after schema changes: pnpm --filter @chenaikit/backend prisma:generate.
- Rebuild backend after migrations: pnpm --filter @chenaikit/backend build.
