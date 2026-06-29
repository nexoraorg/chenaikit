# Getting Started with ChenAIKit

Welcome to ChenAIKit! This guide will help you get up and running with our AI-powered blockchain toolkit.

## What is ChenAIKit?

ChenAIKit is a TypeScript toolkit that makes it easy to build AI-powered blockchain applications. It provides:

- 🧠 AI model integrations for credit scoring and fraud detection
- 🔗 Blockchain connectors for Stellar and Soroban
- ⚙️ TypeScript SDK with strong typing
- 🛠 Examples and templates to jump-start your project

## Installation

### Core Package

```bash
npm install @chenaikit/core
# or
pnpm add @chenaikit/core
# or
yarn add @chenaikit/core
```

### CLI Tool

```bash
npm install -g @chenaikit/cli
# or
pnpm add -g @chenaikit/cli
# or
yarn global add @chenaikit/cli
```

## Quick Start

### 1. Basic Setup

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
```

### 2. Get Account Information

```typescript
// Get account data
const account = await stellar.getAccount('G...');
console.log('Account:', account);
```

### 3. Calculate Credit Score

```typescript
// Calculate credit score
const score = await ai.calculateCreditScore(account);
console.log('Credit Score:', score);
```

### 4. Detect Fraud

```typescript
// Detect fraud in transaction
const isFraud = await ai.detectFraud(transactionData);
console.log('Is Fraud:', isFraud);
```

## Next Steps

- Check out our [API Reference](./api-reference.md)
- Explore [Tutorials](./tutorials/)
- Look at [Examples](../examples/) for complete applications
- Join our community for support and contributions

## Need Help?

- 📖 Read the documentation
- 🐛 Report issues on GitHub
- 💬 Join our Discord community
- 📧 Contact us at support@chenaikit.com
