# DEX Trading Bot Example

Demonstrates how to use `DexConnector` and `DexAnalytics` from `@chenaikit/core`.

## What it does

- Fetches XLM/USDC order book from Stellar testnet
- Calculates mid-market price and applies slippage tolerance
- Finds optimal payment paths using Horizon strict-receive
- Reports 24h volume, VWAP, spread, and price impact estimates
- Lists available liquidity pools

## Run
```bash
npx ts-node examples/dex-trading-bot/index.ts
```

## Placing real orders

`placeOrder()`, `depositLiquidity()`, and `executePathPayment()` require
`@stellar/stellar-sdk` for transaction signing. Install it and implement
the keypair signing logic in `packages/core/src/stellar/dex.ts`.
```bash
npm install @stellar/stellar-sdk
```
