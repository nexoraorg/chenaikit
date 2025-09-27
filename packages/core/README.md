# @chenaikit/core

> Core TypeScript SDK for ChenAIKit - AI-powered blockchain applications

[![npm version](https://badge.fury.io/js/%40chenaikit%2Fcore.svg)](https://badge.fury.io/js/%40chenaikit%2Fcore)
[![Build Status](https://github.com/your-org/chenaikit/workflows/CI/badge.svg)](https://github.com/your-org/chenaikit/actions)
[![Coverage Status](https://coveralls.io/repos/github/your-org/chenaikit/badge.svg?branch=main)](https://coveralls.io/github/your-org/chenaikit?branch=main)

A TypeScript toolkit for building AI-powered blockchain applications with Stellar integration and gamified learning experiences.

## Features

- 🧠 **AI Integrations** – Ready-to-use AI service wrappers
- 🔗 **Blockchain Connectors** – Simple APIs for Stellar blockchain interactions
- ⚙️ **TypeScript SDK** – Strongly-typed, easy to extend, works in Node.js and browser
- 🎮 **Gamification** – Quest system, skill trees, and NFT rewards
- 📊 **Progress Tracking** – Comprehensive user progress analytics
- 🛠️ **Developer Tools** – Validation, formatting, and utility functions

## Installation

```bash
npm install @chenaikit/core
# or
yarn add @chenaikit/core
# or
pnpm add @chenaikit/core
```

## Quick Start

```typescript
import { createClient } from '@chenaikit/core';

// Initialize the client
const client = await createClient({
  stellar: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  ai: {
    apiBaseUrl: 'https://api.chenaikit.com',
    apiKey: 'your-api-key',
  },
});

await client.initialize();

// Get user progress
const progress = await client.getUserProgress('user-id');

// Start a quest
const quest = await client.startQuest('user-id', 'quest-id');

// Mint NFT for quest completion
const nft = await client.mintQuestNFT('user-id', 'quest-id', 'badge');
```

## API Reference

### Core Client

#### `createClient(config?)`

Creates a new ChenAIKit client instance.

**Parameters:**
- `config` (optional): Configuration object

**Returns:** `ChenAIKitClient`

#### `ChenAIKitClient`

Main client class for interacting with ChenAIKit services.

**Methods:**

- `initialize()`: Initialize the client
- `getUserProfile(userId)`: Get user profile information
- `getUserProgress(userId)`: Get user progress and statistics
- `getQuests(category?, difficulty?)`: Get available quests
- `startQuest(userId, questId)`: Start a quest
- `completeQuest(userId, questId, progress?)`: Complete a quest
- `mintQuestNFT(userId, questId, nftType)`: Mint NFT for quest completion
- `getUserNFTs(userId)`: Get user's NFTs

### Stellar Integration

#### `StellarClient`

Client for Stellar blockchain operations.

**Methods:**

- `getAccount(accountId)`: Get account information
- `createAccount()`: Create a new Stellar account
- `fundAccount(publicKey)`: Fund account with testnet tokens
- `mintNFT(userId, questId, nftType)`: Mint NFT using smart contract
- `getUserNFTs(userId)`: Get user's NFTs from blockchain
- `transferNFT(nftId, fromUserId, toUserId)`: Transfer NFT between users

### AI Services

#### `AIClient`

Client for AI service operations.

**Methods:**

- `getUserProfile(userId)`: Get user profile
- `updateUserProfile(userId, updates)`: Update user profile
- `getUserProgress(userId)`: Get user progress
- `getQuests(category?, difficulty?)`: Get available quests
- `startQuest(userId, questId)`: Start a quest
- `completeQuest(userId, questId, progress?)`: Complete a quest
- `getProgressGraph(userId)`: Get progress visualization data

### Utilities

#### Validation

```typescript
import { isValidEmail, isValidUUID, validateRequired } from '@chenaikit/core/utils';

isValidEmail('user@example.com'); // true
isValidUUID('123e4567-e89b-12d3-a456-426614174000'); // true
validateRequired({ name: 'John' }, ['name', 'email']); // throws ValidationError
```

#### Formatting

```typescript
import { formatBytes, formatDuration, formatXP } from '@chenaikit/core/utils';

formatBytes(1024); // "1 KB"
formatDuration(3661000); // "1h 1m 1s"
formatXP(1500); // "1.5K XP"
```

#### Crypto

```typescript
import { generateUUID, generateRandomString, simpleHash } from '@chenaikit/core/utils';

generateUUID(); // "123e4567-e89b-12d3-a456-426614174000"
generateRandomString(10); // "aB3dEfGhIj"
simpleHash('hello world'); // "5d41402abc4b2a76b9719d911017c592"
```

## Configuration

```typescript
interface ChenAIKitConfig {
  stellar: {
    network: 'testnet' | 'mainnet';
    horizonUrl: string;
    keypair?: Keypair;
    passphrase?: string;
  };
  ai: {
    apiBaseUrl: string;
    apiKey?: string;
    timeout?: number;
  };
  cache: {
    ttl: number;
    enabled?: boolean;
  };
}
```

## Types

The package exports comprehensive TypeScript types for all data structures:

- `UserProfile`: User information
- `Quest`: Quest data structure
- `UserProgress`: Progress tracking
- `BadgeNFT`: Badge NFT information
- `CharacterNFT`: Character NFT information
- `Skill`: Skill information
- `ApiResponse<T>`: Generic API response wrapper

## Error Handling

The SDK provides specific error types:

```typescript
import { ChenAIKitError, StellarError, APIError, ValidationError } from '@chenaikit/core';

try {
  await client.startQuest('user-id', 'quest-id');
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.message, error.statusCode);
  } else if (error instanceof ValidationError) {
    console.error('Validation Error:', error.message, error.details);
  }
}
```

## Events

The client emits events for various operations:

```typescript
client.on('quest:started', (data) => {
  console.log('Quest started:', data.questId);
});

client.on('quest:completed', (data) => {
  console.log('Quest completed:', data.questId, data.rewards);
});

client.on('nft:minted', (data) => {
  console.log('NFT minted:', data.nftId, data.type);
});

client.on('error', (data) => {
  console.error('Error:', data.error);
});
```

## Browser Support

The package works in both Node.js and browser environments. For browser usage, make sure to include the necessary polyfills if targeting older browsers.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Type check
pnpm type-check
```

## Contributing

Please read our [Contributing Guide](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.chenaikit.com)
- 🐛 [Issue Tracker](https://github.com/your-org/chenaikit/issues)
- 💬 [Discord Community](https://discord.gg/chenaikit)
- 📧 [Email Support](mailto:support@chenaikit.com)
