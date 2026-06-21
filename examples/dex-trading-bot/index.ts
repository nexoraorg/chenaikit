/**
 * Example DEX Trading Bot — demonstrates DexConnector and DexAnalytics usage.
 *
 * This bot monitors XLM/USDC spread and logs analytics every 30 seconds.
 * It does NOT place real orders — extend placeOrder() with Stellar SDK signing.
 *
 * Usage:
 *   npx ts-node examples/dex-trading-bot/index.ts
 */

import { DexConnector } from '../../packages/core/src/stellar/dex';
import { DexAnalytics } from '../../packages/core/src/stellar/dex-analytics';
import { Asset } from '../../packages/core/src/types/dex';

const XLM: Asset = { code: 'XLM' };
const USDC: Asset = {
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

const connector = new DexConnector({ network: 'testnet', slippageTolerance: 0.01 });
const analytics = new DexAnalytics({ network: 'testnet' });

async function runBot(): Promise<void> {
  console.log('=== Stellar DEX Trading Bot (testnet) ===\n');

  // 1. Fetch order book
  console.log('Fetching XLM/USDC order book...');
  const orderBook = await connector.getOrderBook(XLM, USDC, 5);
  console.log('Top 5 bids:', orderBook.bids);
  console.log('Top 5 asks:', orderBook.asks);

  // 2. Get current price
  const price = await connector.getPrice(XLM, USDC);
  console.log(`\nMid-market price: ${price.price} USDC per XLM`);

  // 3. Apply slippage
  const slippedAmount = connector.applySlippage('100', true);
  console.log(`Max spend with 1% slippage on 100 XLM buy: ${slippedAmount} XLM`);

  // 4. Find payment paths
  console.log('\nFinding payment paths for 10 USDC...');
  try {
    const paths = await connector.findPaymentPaths(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      USDC,
      '10'
    );
    if (paths.length > 0) {
      console.log('Best path:', paths[0]);
    } else {
      console.log('No paths found.');
    }
  } catch (e) {
    console.log('Path finding unavailable on testnet for this pair.');
  }

  // 5. Analytics
  console.log('\nFetching 24h stats...');
  const stats = await analytics.get24hStats(XLM, USDC);
  console.log('24h stats:', stats);

  const spread = await analytics.getSpread(XLM, USDC);
  console.log(`\nOrder book spread: ${spread.toFixed(4)}%`);

  const vwap = await analytics.getVWAP(XLM, USDC, 50);
  console.log(`VWAP (last 50 trades): ${vwap} USDC per XLM`);

  const impact = await analytics.estimatePriceImpact(XLM, USDC, '1000', 'buy');
  console.log(`Estimated price impact for 1000 XLM buy: ${impact.toFixed(4)}%`);

  // 6. Liquidity pools
  console.log('\nListing liquidity pools...');
  const pools = await connector.listLiquidityPools(undefined, 3);
  console.log(`Found ${pools.length} pools.`);
  if (pools.length > 0) {
    console.log('First pool:', pools[0]);
  }

  console.log('\nBot cycle complete. Re-run to refresh data.');
}

runBot().catch(console.error);
