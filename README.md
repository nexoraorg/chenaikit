# chenaikit

A monorepo for chenaikit: Soroban smart contracts, a backend API, a frontend
web app, shared TS packages, and a Python ML pipeline.

## Project structure

```
chenaikit/
├── apps/
│   ├── backend/          # API service (Express + Prisma)
│   └── frontend/         # Web app (React + Vite), uses the shared design system
├── contracts/            # Soroban contracts only — no loose docs at this level
│   ├── credit-score/
│   ├── fraud-detect/
│   ├── governance/
│   ├── oracle-network/
│   ├── model-attestation/
│   └── common-utils/
├── packages/             # Shared TS SDK/libraries consumed by apps + examples
│   ├── core/
│   ├── cli/
│   ├── oracle-node/
│   └── chenai-mlflow/
├── ml/                   # Python ML pipeline
├── examples/             # Sample integrations
├── docs/
│   ├── architecture/     # migration-map.md, design-system.md
│   ├── contracts/        # upgrade/audit docs live here, not at contracts/ root
│   └── contributing/
├── tests/
│   └── integration/
├── scripts/
└── .github/
    ├── workflows/
    ├── PULL_REQUEST_TEMPLATE.md
    └── ISSUE_TEMPLATE/
```

## Getting started

```bash
pnpm install
pnpm build
pnpm test:all
```

Contracts:

```bash
cd contracts
cargo build
cargo test
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit
conventions, and the PR process.

## Design system

Frontend styling is driven by shared tokens — see
[`docs/architecture/design-system.md`](./docs/architecture/design-system.md).
