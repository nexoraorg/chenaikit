/**
 * DexAnalytics — statistics and analytics for Stellar DEX trading pairs.
 */

import { DexConfig, Asset, DexStats, DexTrade, OrderBook } from '../types/dex';
import { DexConnector, withRetry } from './dex';

export class DexAnalytics {
  private connector: DexConnector;
  private horizonUrl: string;

  constructor(config: DexConfig) {
    this.connector = new DexConnector(config);
    this.horizonUrl =
      config.horizonUrl ??
      (config.network === 'mainnet'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org');
  }

  /**
   * Fetch recent trades for an asset pair.
   *
   * @param base - Base asset
   * @param counter - Counter asset
   * @param limit - Number of trades to return (default 50)
   */
  async getRecentTrades(base: Asset, counter: Asset, limit = 50): Promise<DexTrade[]> {
    const getAssetType = (a: Asset) =>
      !a.issuer ? 'native' : a.code.length > 4 ? 'credit_alphanum12' : 'credit_alphanum4';

    return withRetry(async () => {
      const params = new URLSearchParams({
        base_asset_type: getAssetType(base),
        ...(base.issuer ? { base_asset_code: base.code, base_asset_issuer: base.issuer } : {}),
        counter_asset_type: getAssetType(counter),
        ...(counter.issuer ? { counter_asset_code: counter.code, counter_asset_issuer: counter.issuer } : {}),
        limit: String(limit),
        order: 'desc',
      });

      const res = await fetch(`${this.horizonUrl}/trades?${params}`);
      if (!res.ok) throw new Error(`Horizon error: ${res.status}`);

      const data = await res.json();
      return (data._embedded?.records ?? []).map((t: any) => ({
        id: t.id,
        offerId: t.offer_id ?? '',
        baseAccount: t.base_account ?? '',
        baseAmount: t.base_amount,
        baseAsset: base,
        counterAmount: t.counter_amount,
        counterAsset: counter,
        price: t.price?.n && t.price?.d
          ? String(t.price.n / t.price.d)
          : '0',
        timestamp: t.ledger_close_time,
      }));
    }, 3);
  }

  /**
   * Compute 24h statistics for an asset pair from recent trades.
   */
  async get24hStats(base: Asset, counter: Asset): Promise<DexStats> {
    const trades = await this.getRecentTrades(base, counter, 200);

    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    const recent = trades.filter(
      t => new Date(t.timestamp).getTime() > cutoff
    );

    if (recent.length === 0) {
      return {
        asset: base,
        baseVolume: '0',
        counterVolume: '0',
        tradeCount: 0,
        open: '0',
        high: '0',
        low: '0',
        close: '0',
        timestamp: new Date().toISOString(),
      };
    }

    const prices = recent.map(t => parseFloat(t.price));
    const baseVolume = recent.reduce((s, t) => s + parseFloat(t.baseAmount), 0);
    const counterVolume = recent.reduce((s, t) => s + parseFloat(t.counterAmount), 0);

    return {
      asset: base,
      baseVolume: baseVolume.toFixed(7),
      counterVolume: counterVolume.toFixed(7),
      tradeCount: recent.length,
      open: recent[recent.length - 1].price,
      close: recent[0].price,
      high: Math.max(...prices).toFixed(7),
      low: Math.min(...prices).toFixed(7),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate order book spread (ask - bid) as a percentage.
   */
  async getSpread(base: Asset, counter: Asset): Promise<number> {
    const book: OrderBook = await this.connector.getOrderBook(base, counter, 1);
    const bestBid = parseFloat(book.bids[0]?.price ?? '0');
    const bestAsk = parseFloat(book.asks[0]?.price ?? '0');
    if (bestBid === 0 || bestAsk === 0) return 0;
    return ((bestAsk - bestBid) / bestAsk) * 100;
  }

  /**
   * Calculate volume-weighted average price (VWAP) from recent trades.
   */
  async getVWAP(base: Asset, counter: Asset, limit = 100): Promise<string> {
    const trades = await this.getRecentTrades(base, counter, limit);
    if (trades.length === 0) return '0';

    let numerator = 0;
    let denominator = 0;

    for (const trade of trades) {
      const price = parseFloat(trade.price);
      const volume = parseFloat(trade.baseAmount);
      numerator += price * volume;
      denominator += volume;
    }

    return denominator === 0 ? '0' : (numerator / denominator).toFixed(7);
  }

  /**
   * Estimate price impact of a trade given order book depth.
   * Returns estimated slippage as a percentage.
   */
  async estimatePriceImpact(
    base: Asset,
    counter: Asset,
    tradeAmount: string,
    side: 'buy' | 'sell'
  ): Promise<number> {
    const book = await this.connector.getOrderBook(base, counter, 50);
    const offers = side === 'buy' ? book.asks : book.bids;

    if (offers.length === 0) return 100;

    const bestPrice = parseFloat(offers[0].price);
    let remaining = parseFloat(tradeAmount);
    let totalCost = 0;

    for (const offer of offers) {
      const offerAmount = parseFloat(offer.amount);
      const offerPrice = parseFloat(offer.price);

      if (remaining <= 0) break;

      const filled = Math.min(remaining, offerAmount);
      totalCost += filled * offerPrice;
      remaining -= filled;
    }

    if (remaining > 0) return 100; // insufficient liquidity

    const avgPrice = totalCost / parseFloat(tradeAmount);
    return Math.abs((avgPrice - bestPrice) / bestPrice) * 100;
  }
}
