# @chenaikit/core

Core TypeScript SDK for ChenAIKit - AI-powered blockchain applications.

## Features

- 🧠 AI model integrations
- 🔗 Stellar Horizon API connector
- ⚙️ Soroban smart contract interactions
- 📊 Credit scoring utilities
- 🛡️ Fraud detection helpers

## Installation

```bash
npm install @chenaikit/core
# or
pnpm add @chenaikit/core
# or
yarn add @chenaikit/core
```

## Quick Start

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

// Get account data
const account = await stellar.getAccount('G...');

// Run credit scoring
const score = await ai.calculateCreditScore(account);
```

## API Reference

See the [documentation](../../docs/api-reference.md) for detailed API reference.
