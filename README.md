# ChenAIKit

> ⚡ A TypeScript toolkit for building AI-powered blockchain applications.

AI Kit helps developers quickly add machine-learning features like credit scoring, fraud detection, and smart decisioning to their apps.  
It wraps common blockchain operations (starting with Stellar support) and connects them to AI models so you can focus on building products instead of plumbing.

---

## ✨ Features

- 🧠 *AI integrations* – ready-to-use wrapper for credit scoring and fraud detection
- 🔗 *Blockchain connectors* – simple APIs for Stellar Horizon and Soroban contracts
- ⚙ *TypeScript SDK* – strongly-typed, easy to extend, works in Node and browser
- 🛠 *Examples & templates* – jump-start your own project with working examples
- 🎯 *CLI tools* – command-line interface for common operations
- 📊 *Smart contracts* – pre-built Soroban contracts for common use cases

---

## 🏗️ Project Structure

```
chenaikit/
├── packages/
│   ├── core/                 # Core TypeScript SDK
│   └── cli/                  # CLI tool
├── contracts/                # Soroban smart contracts
│   ├── credit-score/         # Credit scoring contract
│   ├── fraud-detect/         # Fraud detection contract
│   └── common-utils/         # Shared utilities
├── examples/                 # Sample applications
│   ├── credit-scoring-app/   # Credit scoring example
│   ├── wallet-chatbot/       # Wallet chatbot example
│   └── fraud-detection-service/ # Fraud detection example
├── docs/                     # Documentation
└── tests/                    # Test suites
```

---

## 🚀 Quick Start

### Install the core package:

```bash
pnpm install @chenaikit/core
```

### Install the CLI tool:

```bash
pnpm install -g @chenaikit/cli
```

### Basic usage:

```typescript
import { StellarConnector, AIService } from '@chenaikit/core';

// Initialize Stellar connection
const stellar = new StellarConnector({
  network: 'testnet'
});

// Initialize AI service
const ai = new AIService({
  apiKey: process.env.AI_API_KEY
});

// Get account data and calculate credit score
const account = await stellar.getAccount('G...');
const score = await ai.calculateCreditScore(account);
```

---

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Examples](examples/)
- [Smart Contracts](contracts/)

---

## 🤝 Contributing

We welcome contributions! Check out our [issue templates](.github/ISSUE_TEMPLATE/) for beginner-friendly tasks:

- **Frontend**: React components, UI/UX, data visualization
- **Backend**: APIs, databases, authentication, monitoring
- **AI**: Machine learning models, fraud detection, NLP
- **Blockchain**: Stellar integration, Soroban contracts, DEX features

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
