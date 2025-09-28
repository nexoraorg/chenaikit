# Contributing to ChenAIKit

Welcome to ChenAIKit! We're excited to have you contribute to this AI-powered blockchain toolkit.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/your-username/chenaikit.git`
3. **Install dependencies**: `pnpm install`
4. **Choose an issue** from our [issue templates](.github/ISSUE_TEMPLATE/)
5. **Create a branch**: `git checkout -b feature/your-feature-name`
6. **Make your changes** and test them
7. **Submit a pull request**

## 📋 Available Issues

We have **24 beginner-friendly issues** organized by category:

### 🎨 Frontend (6 issues)
- **frontend-01-react-components.md** - Implement React components for credit score dashboard
- **frontend-02-wallet-ui.md** - Create wallet interface components
- **frontend-03-fraud-alerts.md** - Build fraud detection alert system
- **frontend-04-data-visualization.md** - Add data visualization components
- **frontend-05-form-validation.md** - Implement form validation
- **frontend-06-responsive-layout.md** - Create responsive layouts

### 🔧 Backend (6 issues)
- **backend-01-api-endpoints.md** - Implement REST API endpoints
- **backend-02-database-models.md** - Create database models
- **backend-03-authentication.md** - Add authentication system
- **backend-04-caching.md** - Implement caching layer
- **backend-05-webhooks.md** - Create webhook system
- **backend-06-monitoring.md** - Add monitoring and logging

### 🤖 AI (6 issues)
- **ai-01-model-integration.md** - Create AI model integration base class
- **ai-02-fraud-detection.md** - Implement fraud detection AI model
- **ai-03-nlp-processing.md** - Add NLP processing capabilities
- **ai-04-recommendation-engine.md** - Build recommendation engine
- **ai-05-predictive-analytics.md** - Implement predictive analytics
- **ai-06-model-ops.md** - Add model operations and monitoring

### ⛓️ Blockchain (6 issues)
- **blockchain-01-stellar-integration.md** - Implement Stellar Horizon API connector
- **blockchain-02-soroban-contracts.md** - Create Soroban smart contract connector
- **blockchain-03-transaction-monitoring.md** - Build transaction monitoring system
- **blockchain-04-dex-integration.md** - Add DEX integration features
- **blockchain-05-cross-chain.md** - Implement cross-chain functionality
- **blockchain-06-governance.md** - Create governance mechanisms

## 🏗️ Project Structure

```
chenaikit/
├── packages/           # Core SDK packages
│   ├── core/          # TypeScript SDK
│   └── cli/           # CLI tool
├── backend/           # Backend services
├── frontend/          # Frontend applications
├── contracts/         # Soroban smart contracts
├── examples/          # Sample applications
├── docs/              # Documentation
└── tests/             # Test suites
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 20.x
- pnpm 8.x
- Rust (for blockchain development)

### Commands
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm type-check

# Build specific components
pnpm backend:build    # Backend + Core + CLI
pnpm frontend:build   # Frontend + Examples
pnpm blockchain:build # Smart contracts
```

## 📝 Code Style

- Use **TypeScript** for all new code
- Follow **ESLint** configuration
- Use **Prettier** for formatting
- Write **JSDoc** comments for public APIs
- Include **unit tests** for new features

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm backend:test
pnpm frontend:test
pnpm blockchain:test
```

## 📚 Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Community

- **Discord**: [Join our community](https://discord.gg/chenaikit)
- **GitHub Discussions**: [Ask questions](https://github.com/nexoraorg/chenaikit/discussions)
- **Twitter**: [@ChenAIKit](https://twitter.com/chenaikit)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy coding! 🚀**