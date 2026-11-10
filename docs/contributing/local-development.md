# Local Development Workflow Guide

This guide covers everything needed to set up, build, test, and run the `chenaikit` monorepo locally.

---

## 1. Prerequisites & Runtime Requirements

Before cloning and setting up the monorepo, install the following required toolchains:

| Tool | Minimum Version | Purpose | Installation |
|---|---|---|---|
| **Node.js** | `>= 20.x` (LTS) | Frontend, backend, and package execution | [nodejs.org](https://nodejs.org/) |
| **pnpm** | `>= 9.x` | Monorepo workspace package manager | `npm install -g pnpm` |
| **Rust & Cargo** | `>= 1.79.0` | Soroban smart contracts | [rustup.rs](https://rustup.rs/) |
| **wasm32 Target** | `wasm32-unknown-unknown` | Soroban contract compilation | `rustup target add wasm32-unknown-unknown` |
| **Python** | `>= 3.10` | ML pipeline and model weights | [python.org](https://www.python.org/) |

---

## 2. Monorepo Setup & Dependency Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nexoraorg/chenaikit.git
   cd chenaikit
   ```

2. **Install all dependencies:**
   ```bash
   pnpm install
   ```

3. **Build shared packages:**
   ```bash
   pnpm build
   ```

---

## 3. Environment Configuration

Copy example environment configurations for each application service. Never commit `.env` files or secrets to source control.

### Backend (`apps/backend`)
```bash
cp apps/backend/.env.example apps/backend/.env
```
Default safe development settings:
```ini
PORT=4000
NODE_ENV=development
DATABASE_URL="file:./dev.db" # Or local postgresql://postgres:postgres@localhost:5432/chenai_dev
JWT_SECRET="dev-insecure-secret-key-replace-in-prod"
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
```

### Frontend (`apps/frontend`)
```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```
Default settings:
```ini
VITE_API_BASE_URL="http://localhost:4000"
VITE_STELLAR_NETWORK="testnet"
```

---

## 4. Component Development Commands

### Web App (`apps/frontend`)
```bash
# Start frontend development server with hot reload
cd apps/frontend
npm run dev
# Running on http://localhost:5173
```

### Backend API (`apps/backend`)
```bash
cd apps/backend
# Generate database schema client
pnpm prisma generate
# Start backend API with hot reload
pnpm dev
# Running on http://localhost:4000
```

### Smart Contracts (`contracts/`)
```bash
cd contracts

# Run unit tests natively
cargo test

# Build WASM binaries
cargo build --target wasm32-unknown-unknown --release
```

### ML Pipeline (`ml/`)
```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.pipeline
```

---

## 5. Local Pre-PR Verification Commands

Before opening a pull request, run the exact verification checks that execute in CI:

### Frontend CI Verification
```bash
cd apps/frontend
npm run lint
npx tsc --noEmit
npm run test
npx vite build
```

### Backend CI Verification
```bash
pnpm lint
pnpm tsc -p apps/backend/tsconfig.json --noEmit
pnpm test:all
pnpm build
```

### Contracts CI Verification
```bash
cd contracts
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --workspace --release --target wasm32-unknown-unknown
```

### Secret Scanning
Ensure no sensitive keys are accidentally staged:
```bash
npx trufflehog filesystem .
```
