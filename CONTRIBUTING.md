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

## Secret scanning

**Never commit secrets, API keys, or sensitive credentials to the repository.**

### What to avoid

- API keys (Stripe, OpenAI, AWS, etc.)
- Private keys or certificates
- Database credentials
- OAuth tokens
- Environment files containing secrets (`.env`, `.env.local`)
- Personal access tokens

### Pre-commit checks

Before committing, run secret scanning locally:

```bash
# Using truffleHog (recommended)
npx trufflehog filesystem .

# Or using gitleaks
gitleaks detect --source .
```

### If you accidentally commit a secret

1. **Do not** just remove it from the latest commit — the secret remains in git history
2. Rotate/revolve the compromised credential immediately
3. Remove the secret from all commits using `git filter-repo` or BFG Repo-Cleaner
4. Force push with caution (notify team first)
5. Consider the repository compromised if it was a high-value secret

### Best practices

- Use environment variables for secrets (document required variables in `.env.example`)
- Add `.env` and `.env.local` to `.gitignore`
- Use secret management services (e.g., AWS Secrets Manager, HashiCorp Vault) for production
- Enable GitHub secret scanning in repository settings (enabled by default on public repos)
- Review the [GitHub Secret Scanning documentation](https://docs.github.com/en/code-security/secret-scanning)

## Dependency auditing & advisory triage

Continuous integration runs `.github/workflows/dependency-audit.yml` across both the JavaScript/TypeScript workspaces (`pnpm audit` at the repo root and `npm audit` in `apps/frontend`) and the Rust Soroban workspace (`cargo audit` in `contracts/`).

### Running audits locally

```bash
# Workspace JavaScript/TypeScript packages (apps/backend, packages/*)
pnpm audit

# Frontend application (apps/frontend)
cd apps/frontend && npm audit

# Soroban smart contracts (contracts/*)
cd contracts && cargo audit
```

### Warnings vs. release blockers

To avoid blocking unrelated pull requests on newly disclosed upstream transitive advisories while maintaining a strict release gate, findings are classified into two tiers:

| Classification | Criteria | CI & release behavior |
| --- | --- | --- |
| **Warning** | `low`, `moderate`, or `high` JS advisories; `unmaintained` / informational Rust advisories; or advisories with no upstream patch yet | Emitted as CI `::warning::` annotations and included in the workflow step summary and JSON artifacts without failing unrelated PRs. Triaged during weekly maintenance. |
| **Release blocker** | `critical` runtime vulnerabilities or Rust soundness/security advisories where a patched version exists | Highlighted as **RELEASE BLOCKER** in the audit report (and fails the workflow when `enforce_blockers: true` is triggered prior to cutting a release). Must be patched or explicitly mitigated before release. |

### Triage & upgrade ownership

| Domain / Lockfile | Primary Owners | Remediation workflow |
| --- | --- | --- |
| `pnpm-lock.yaml` (`apps/backend/`, `packages/*`) | Backend & SDK maintainers | Upgrade the affected package in the workspace manifest, regenerate `pnpm-lock.yaml`, and verify with `pnpm build && pnpm test:all`. |
| `apps/frontend/package-lock.json` (`apps/frontend/`) | Frontend maintainers | Upgrade the dependency in `apps/frontend/package.json`, run `npm install`, and verify with `npm run lint && npx tsc --noEmit && npx vite build`. |
| `contracts/Cargo.lock` (`contracts/*`) | Smart-contract maintainers | Run `cargo update -p <crate>` in `contracts/` (or bump the version in `contracts/Cargo.toml`) and verify with `cargo test --workspace`. |
