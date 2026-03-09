# Your First Credit Score Calculation

This tutorial will guide you through calculating your first credit score using ChenAIKit. You'll learn how to connect to the Stellar network, fetch account data, and use AI services to calculate a credit score.

## Prerequisites

- Node.js 18+ installed
- Basic knowledge of TypeScript/JavaScript
- A Stellar testnet account (we'll show you how to create one)
- 15 minutes of your time

## Step 1: Install ChenAIKit

First, create a new project and install the core package:

```bash
mkdir my-credit-app
cd my-credit-app
npm init -y
npm install @chenaikit/core dotenv
npm install -D typescript @types/node ts-node
```

Initialize TypeScript:

```bash
npx tsc --init
```

## Step 2: Set Up Environment Variables

Create a `.env` file in your project root:

```env
# Stellar Network Configuration
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org

# AI Service Configuration (optional for this tutorial)
AI_API_KEY=your_api_key_here
```

## Step 3: Create Your First Script

Create a file named `calculate-score.ts`:

```typescript
import { StellarConnector, AIService } from '@chenaikit/core';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Step 1: Initialize Stellar connector
  console.log('🔗 Connecting to Stellar testnet...');
  const stellar = new StellarConnector({
    network: 'testnet',
    horizonUrl: process.env.HORIZON_URL
  });

  // Step 2: Get account data
  // Replace with your Stellar testnet account ID
  const accountId = 'GABC...'; // Your testnet account
  
  console.log(`📊 Fetching account data for ${accountId}...`);
  const account = await stellar.getAccount(accountId);
  
  console.log('Account balances:');
  account.balances.forEach(balance => {
    console.log(`  - ${balance.asset_type}: ${balance.balance}`);
  });

  // Step 3: Initialize AI service
  console.log('\n🧠 Initializing AI service...');
  const ai = new AIService({
    apiKey: process.env.AI_API_KEY || 'demo'
  });

  // Step 4: Calculate credit score
  console.log('🎯 Calculating credit score...');
  const score = await ai.calculateCreditScore(account);
  
  console.log(`\n✅ Credit Score: ${score}/1000`);
  
  // Step 5: Get score factors
  const factors = await ai.getScoreFactors(account);
  console.log('\n📈 Score Factors:');
  factors.forEach(factor => {
    console.log(`  - ${factor}`);
  });
}

main().catch(console.error);
```

## Step 4: Create a Testnet Account (If You Don't Have One)

If you don't have a Stellar testnet account, create one using Stellar Laboratory:

1. Visit [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
2. Click "Generate keypair"
3. Save your public and secret keys securely
4. Click "Get test network lumens" to fund your account

Alternatively, use the ChenAIKit CLI:

```bash
npx @chenaikit/cli account create --network testnet
```

## Step 5: Run Your Script

```bash
npx ts-node calculate-score.ts
```

Expected output:

```
🔗 Connecting to Stellar testnet...
📊 Fetching account data for GABC...
Account balances:
  - native: 10000.0000000
  
🧠 Initializing AI service...
🎯 Calculating credit score...

✅ Credit Score: 750/1000

📈 Score Factors:
  - Account age: 30 days
  - Transaction history: 15 transactions
  - Balance stability: High
  - Network activity: Moderate
```

## Understanding the Results

The credit score is calculated based on several factors:

- **Account Age**: Older accounts generally have higher scores
- **Transaction History**: More transactions indicate active usage
- **Balance Stability**: Consistent balances show financial stability
- **Network Activity**: Participation in the Stellar ecosystem

## Next Steps

Now that you've calculated your first credit score, try these:

1. **Monitor Multiple Accounts**: Loop through multiple account IDs
2. **Track Score Changes**: Store scores in a database and track over time
3. **Add Fraud Detection**: Use `ai.detectFraud()` to check transactions
4. **Build a Dashboard**: Create a web interface to display scores

## Common Issues

### "Account not found"
- Ensure your account is funded on testnet
- Verify you're using the correct network (testnet vs mainnet)

### "Invalid API key"
- Check your `.env` file has the correct `AI_API_KEY`
- For testing, you can use 'demo' as the API key

### "Connection timeout"
- Check your internet connection
- Verify the Horizon URL is correct
- Try using the default testnet URL

## Learn More

- [API Reference](../api-reference.md) - Complete API documentation
- [Deploying Contracts Tutorial](./deploying-contracts.md) - Deploy smart contracts
- [Architecture Overview](../architecture/overview.md) - System architecture
- [Examples](../../examples/) - More complete examples

## Get Help

- 🐛 [Report Issues](https://github.com/nexoraorg/chenaikit/issues)
- 💬 [Join Discord](https://discord.gg/chenaikit)
- 📧 [Email Support](mailto:support@chenaikit.com)
