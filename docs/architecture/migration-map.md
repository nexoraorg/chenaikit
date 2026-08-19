# Migration map (issue #286, task 1)

| Old path                              | New path                          | Notes |
|----------------------------------------|------------------------------------|-------|
| `backend/`                             | `apps/backend/`                    | verify Docker/Prisma/Jest configs resolve |
| `frontend/`                            | `apps/frontend/`                   | new design system applied |
| `packages/core`, `cli`, `oracle-node`, `chenai-mlflow` | `packages/*` (unchanged) | confirm no app-specific logic leaked in |
| `contracts/*.rs` crates                | `contracts/*` (unchanged)          | loose `.md` files move out |
| `contracts/UPGRADE_*.md`, `audit-report.md` | `docs/contracts/`             | see docs/contracts/README.md |
| `ml/`                                  | `ml/` (unchanged)                  | re-audit scope only |
| `examples/*`                           | `examples/*` (trimmed)             | drop any duplicating `apps/frontend` |
| `tests/`, `tests/integration`          | `tests/integration/`               | dedupe workspace entry |
| `backend/lint_results.json`            | removed                            | generated artifact, add to `.gitignore` |

## Flagged for removal (confirm with a second reviewer before deleting)

- `backend/lint_results.json` — 1.1MB generated lint output, should never have been committed.
- Any `examples/*` app that only re-implements `apps/frontend` screens.

## Open decision

`apps/` vs. keeping `backend/` / `frontend/` at root — this scaffold uses
`apps/` per the issue's proposed structure. Confirm with maintainers before
the real migration PR.
