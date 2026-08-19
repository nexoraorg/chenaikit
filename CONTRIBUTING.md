# Contributing to chenaikit

## Where things live

| Domain                     | Path              |
|-----------------------------|-------------------|
| API service                 | `apps/backend/`   |
| Web app                     | `apps/frontend/`  |
| Soroban contracts           | `contracts/`      |
| Shared SDK/libraries        | `packages/`       |
| ML pipeline                 | `ml/`             |
| Sample integrations         | `examples/`       |
| Docs                        | `docs/`           |
| Cross-package integration tests | `tests/integration/` |

If you're unsure where new code belongs, open a draft PR early and ask —
don't guess and let it live in the wrong domain.

## Branch naming

```
feat/<short-description>      new functionality
fix/<short-description>       bug fix
chore/<short-description>     tooling, deps, cleanup
docs/<short-description>      documentation only
refactor/<short-description>  no behavior change
```

Example: `feat/oracle-node-retry-backoff`

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.
Scope should match the domain, e.g. `feat(backend): ...`, `fix(contracts/credit-score): ...`.

`husky` + `lint-staged` run on commit — a commit-msg hook enforcing this
format should be added under `.husky/` as part of wiring this up (see
issue #286, task 5).

## Pull requests

1. Fill in `.github/PULL_REQUEST_TEMPLATE.md` completely — summary, testing
   done, screenshots for any UI change.
2. Keep PRs scoped to one domain where possible.
3. All CI checks must be green before requesting review.

## Branch protection on `main`

- Direct pushes to `main` are disabled.
- At least **1 approving review** required before merge.
- Required status checks: `ci`, `test`, and the domain-specific workflow
  that touches your changed paths (`backend`, `frontend`, or `blockchain`).
- Branches must be up to date with `main` before merging.

## Local setup

```bash
pnpm install
pnpm build
pnpm test:all
```

For contracts:

```bash
cd contracts
cargo build
cargo test
```
