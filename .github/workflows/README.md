# CI/CD

Three independent build pipelines, one per area of the monorepo. Each is
**path-filtered**, so touching the frontend never spins up a Rust toolchain.
A fourth workflow, `pr-checklist.yml`, is intentionally *not* path-filtered and
runs on every pull request.

| Workflow | Triggers on changes to | What it does |
| --- | --- | --- |
| `frontend.yml` | `apps/frontend/**` | install (npm) → lint → typecheck → test → `vite build` → upload `dist` |
| `backend.yml` | `apps/backend/**`, `packages/**`, `pnpm-workspace.yaml` | install (pnpm) → `prisma generate` → lint → typecheck → test → build; plus a separate shared-packages build job |
| `contracts.yml` | `contracts/**` | Rust toolchain + wasm target → `cargo fmt --check` → `clippy` → `test` → release wasm build → upload `.wasm` |
| `pr-checklist.yml` | *every pull request* | unit-tests the validator → validates the PR description against `.github/PULL_REQUEST_TEMPLATE.md` |

All of them also run on `pull_request` and can be started manually via
**workflow_dispatch**.

## PR checklist validation

`pr-checklist.yml` fails a pull request whose description is missing the
sections `.github/PULL_REQUEST_TEMPLATE.md` asks for, with an annotation and a
job summary naming exactly what is absent.

- **Required:** `## Summary`, `## Testing done`, and `## Checklist` (with at
  least one `- [x]` ticked). Heading aliases (`Test plan`, `Overview`, …),
  emoji and `###` levels are all accepted; headings inside fenced code blocks
  are not.
- **Conditionally required:** `## Screenshots`, when the diff touches UI files
  (`apps/frontend/**`, `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.svg`).
- **Unfilled counts as missing.** The template's hints are HTML comments, which
  are stripped before a section is checked for content.
- **Bypass:** apply the maintainer-only `skip-checklist` label, or open the PR
  as a bot (`dependabot[bot]`, `github-actions[bot]`, `renovate[bot]`, or any
  `*[bot]` login). `labeled`/`unlabeled` are trigger types, so the label takes
  effect right away.

The rules live in `.github/scripts/check-pr-checklist.mjs` as a pure function
and are covered by `.github/scripts/check-pr-checklist.test.mjs`. The workflow
runs those tests as one of its own steps. Locally:

```bash
node --test '.github/scripts/*.test.mjs'
```

### Why `pull_request` and not `pull_request_target`

The workflow executes contributor-authored code from the PR head, so it uses
the plain `pull_request` trigger: on fork PRs GitHub hands the job a
**read-only `GITHUB_TOKEN` and no repository secrets**, leaving nothing
privileged to exfiltrate. `pull_request_target` would grant a write token and
secrets while running against a ref the contributor controls — and validating a
description needs neither. That read-only token is also why the check *fails
loudly* instead of posting a bot comment (commenting needs
`pull-requests: write`, which fork PRs cannot have here). The PR body itself is
untrusted input and is never interpolated into a shell command via `${{ … }}`;
the validator reads it from the webhook payload on disk (`GITHUB_EVENT_PATH`).

## Designed to be green today, meaningful tomorrow

Most of this codebase is still being filled in, so every pipeline degrades
gracefully instead of failing on absence:

- **frontend / backend** — each `lint`, `test`, and `build` step checks whether
  the npm script actually exists first. Missing scripts emit a GitHub
  `::notice::` and move on. Typecheck only runs when a `tsconfig.json` is
  present.
- **contracts** — a `Detect buildable crates` step looks for `*/src/lib.rs`. If
  no crate has sources yet, the Rust steps are skipped via
  `if: steps.detect.outputs.ready == 'true'` and the job still succeeds. As soon
  as a contract lands, format/clippy/test/build begin enforcing automatically.

As real code arrives, no workflow edits are needed — the checks activate on
their own.

## Toolchain choices

- **Node 22 LTS everywhere.** pnpm 9 crashes on Node 24 with
  `ERR_INVALID_THIS` (`Value of "this" must be of type URLSearchParams`), which
  is what was breaking deploys.
- **Frontend uses npm, backend uses pnpm.** The frontend is installed with npm
  in CI so it mirrors exactly how Vercel builds it. The backend depends on
  workspace packages via `workspace:*`, a pnpm-only protocol, so it needs pnpm.
- **`concurrency`** cancels superseded runs on the same ref, so rapid pushes to
  a PR don't pile up.

## Vercel deployments

Deploys are locked down in `vercel.json` plus `scripts/vercel-should-deploy.sh`:

1. `git.deploymentEnabled` allows **only the `main` branch** — pushes to any
   other branch don't even create a deployment.
2. `ignoreCommand` runs the gate script, which cancels the build unless the
   commit is authored by **`gelluisaac`**.

The script follows Vercel's Ignored Build Step contract: **exit 1 = build**,
**exit 0 = cancel**. It matches the author against the GitHub login
(`VERCEL_GIT_COMMIT_AUTHOR_LOGIN`) and falls back to git author name/email, so
the rule holds regardless of which metadata Vercel provides.

Verify the policy locally:

```bash
# wrong branch -> exit 0 (cancelled)
VERCEL_GIT_COMMIT_REF=feat VERCEL_GIT_COMMIT_AUTHOR_LOGIN=gelluisaac \
  bash scripts/vercel-should-deploy.sh; echo $?

# wrong author -> exit 0 (cancelled)
VERCEL_GIT_COMMIT_REF=main VERCEL_GIT_COMMIT_AUTHOR_LOGIN=someoneelse \
  bash scripts/vercel-should-deploy.sh; echo $?

# allowed -> exit 1 (deploys)
VERCEL_GIT_COMMIT_REF=main VERCEL_GIT_COMMIT_AUTHOR_LOGIN=gelluisaac \
  bash scripts/vercel-should-deploy.sh; echo $?
```

To change who can deploy, edit `ALLOWED_AUTHOR` (or `ALLOWED_BRANCH`) at the
top of the script.

## Running the same checks locally

```bash
# frontend
cd apps/frontend && npm install && npx vite build

# backend + shared packages
pnpm install && pnpm --filter @chenaikit/backend run build

# contracts
cd contracts && cargo fmt --all --check && cargo clippy --workspace --all-targets && cargo test --workspace
```
