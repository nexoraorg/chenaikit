# CI/CD Workflows

This directory contains GitHub Actions workflows for the ChenAIKit project, organized into three main areas:

## Workflows

### 🔧 Backend CI (`backend.yml`)
- **Triggers**: Changes to `packages/core/**`, `packages/cli/**`, or `backend/**`
- **Purpose**: Build and test TypeScript packages (core SDK and CLI)
- **Actions**:
  - Build core and CLI packages
  - Run unit tests
  - Lint code
  - Type checking

### ⛓️ Blockchain CI (`blockchain.yml`)
- **Triggers**: Changes to `contracts/**` or blockchain-related code
- **Purpose**: Build and test Soroban smart contracts
- **Actions**:
  - Build all contracts (credit-score, fraud-detect, common-utils)
  - Run contract tests
  - Clippy linting
  - Format checking

### 🎨 Frontend CI (`frontend.yml`)
- **Triggers**: Changes to `examples/**` or frontend components
- **Purpose**: Build and test example applications
- **Actions**:
  - Build example apps (credit-scoring, wallet-chatbot, fraud-detection)
  - Run frontend tests
  - Lint frontend code

## Local Development

You can run the same commands locally:

```bash
# Backend
pnpm backend:build
pnpm backend:test

# Blockchain
pnpm blockchain:build
pnpm blockchain:test

# Frontend
pnpm frontend:build
pnpm frontend:test
```

## Workflow Features

- **Path-based triggers**: Workflows only run when relevant files change
- **Parallel execution**: Each workflow runs independently
- **Error handling**: Frontend builds continue on error for development flexibility
- **Caching**: Dependencies are cached for faster builds
- **Multi-version testing**: Backend tests on Node.js 18.x and 20.x
