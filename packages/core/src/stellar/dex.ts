/**
 * DexConnector — Stellar DEX operations via Horizon API.
 *
 * Supports order book trading, liquidity pool interactions,
 * path payments, and price discovery.
 */

import {
  DexConfig,
  Asset,
  OrderBook,
  PlaceOrderParams,
  OrderResult,
  LiquidityPool,
  LiquidityPoolDepositParams,
  LiquidityPoolWithdrawParams,
  PathPaymentParams,
  PaymentPath,
  PriceData,
} from '../types/dex';

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET = 'https://horizon.stellar.org';

function assetToParams(asset: Asset): Record<string, string> {
  if (!asset.issuer) {
    return { asset_type: 'native' };
  }
  const assetType = asset.code.length > 4 ? 'credit_alphanum12' : 'credit_alphanum4';
  return {
    asset_type: assetType,
    asset_code: asset.code,
    asset_issuer: asset.issuer,
  };
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export class DexConnector {
  private horizonUrl: string;
  private slippageTolerance: number;
  private retries: number;

  constructor(config: DexConfig) {
    this.horizonUrl =
      config.horizonUrl ??
      (config.network === 'mainnet' ? HORIZON_MAINNET : HORIZON_TESTNET);
    this.slippageTolerance = config.slippageTolerance ?? 0.01;
    this.retries = config.retries ?? 3;
  }

  /**
   * Fetch the current order book for a trading pair.
   *
   * @param base - Base asset (e.g. XLM)
   * @param counter - Counter asset (e.g. USDC)
   * @param limit - Number of bids/asks to return (default 20)
   */
  async getOrderBook(base: Asset, counter: Asset, limit = 20): Promise<OrderBook> {
    return withRetry(async () => {
      const params = new URLSearchParams({
        ...this.prefixParams('selling_', assetToParams(base)),
        ...this.prefixParams('buying_', assetToParams(counter)),
        limit: String(limit),
      });

      const res = await fetch(`${this.horizonUrl}/order_book?${params}`);
      if (!res.ok) throw new Error(`Horizon error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      return {
        base,
        counter,
        bids: data.bids ?? [],
        asks: data.asks ?? [],
        timestamp: new Date().toISOString(),
      };
    }, this.retries);
  }

  /**
   * Place a buy or sell order on the DEX.
   * Set offerId=0 to create a new offer, or a positive ID to update an existing one.
   */
  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    // TODO: Implement transaction signing with Stellar SDK
    // Requires: @stellar/stellar-sdk ManageSellOfferOperation
    throw new Error(
      'placeOrder requires Stellar SDK transaction signing. ' +
      'Install @stellar/stellar-sdk and implement keypair signing.'
    );
  }

  /**
   * Cancel an existing DEX offer.
   *
   * NOTE: Requires `@stellar/stellar-sdk` transaction signing (same as placeOrder).
   * This method will throw until placeOrder is implemented.
   *
   * @param sourceAccount - Account that owns the offer
   * @param sourceSecret - Secret key for signing
   * @param offerId - ID of the offer to cancel
   */
  async cancelOrder(
    sourceAccount: string,
    sourceSecret: string,
    offerId: string
  ): Promise<OrderResult> {
    // Cancelling = placing offer with amount=0
    return this.placeOrder({
      sourceAccount,
      sourceSecret,
      selling: { code: 'XLM' },
      buying: { code: 'XLM' },
      amount: '0',
      price: '1',
      offerId,
    });
  }

  /**
   * Fetch details for a specific liquidity pool by ID.
   */
  async getLiquidityPool(poolId: string): Promise<LiquidityPool> {
    return withRetry(async () => {
      const res = await fetch(`${this.horizonUrl}/liquidity_pools/${poolId}`);
      if (!res.ok) throw new Error(`Horizon error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      const [reserveA, reserveB] = data.reserves ?? [{}, {}];

      return {
        id: data.id,
        fee: (data.fee_bp ?? 0) / 10000,
        assetA: this.parseAsset(reserveA.asset),
        assetB: this.parseAsset(reserveB.asset),
        reserveA: reserveA.amount ?? '0',
        reserveB: reserveB.amount ?? '0',
        totalShares: data.total_shares ?? '0',
        totalTrustlines: data.total_trustlines ?? 0,
      };
    }, this.retries);
  }

  /**
   * List all liquidity pools, optionally filtered by assets.
   */
  async listLiquidityPools(assets?: Asset[], limit = 20): Promise<LiquidityPool[]> {
    return withRetry(async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (assets) {
        assets.forEach(a => {
          if (a.issuer) params.append('reserves', `${a.code}:${a.issuer}`);
          else params.append('reserves', 'native');
        });
      }

      const res = await fetch(`${this.horizonUrl}/liquidity_pools?${params}`);
      if (!res.ok) throw new Error(`Horizon error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      return (data._embedded?.records ?? []).map((pool: any) => {
        const [reserveA, reserveB] = pool.reserves ?? [{}, {}];
        return {
          id: pool.id,
          fee: pool.fee_bp / 10000,
          assetA: this.parseAsset(reserveA.asset),
          assetB: this.parseAsset(reserveB.asset),
          reserveA: reserveA.amount ?? '0',
          reserveB: reserveB.amount ?? '0',
          totalShares: pool.total_shares ?? '0',
          totalTrustlines: pool.total_trustlines ?? 0,
        };
      });
    }, this.retries);
  }

  /**
   * Deposit into a liquidity pool.
   */
  async depositLiquidity(params: LiquidityPoolDepositParams): Promise<OrderResult> {
    throw new Error(
      'depositLiquidity requires Stellar SDK transaction signing. ' +
      'Install @stellar/stellar-sdk and implement LiquidityPoolDepositOp.'
    );
  }

  /**
   * Withdraw from a liquidity pool.
   */
  async withdrawLiquidity(params: LiquidityPoolWithdrawParams): Promise<OrderResult> {
    throw new Error(
      'withdrawLiquidity requires Stellar SDK transaction signing. ' +
      'Install @stellar/stellar-sdk and implement LiquidityPoolWithdrawOp.'
    );
  }

  /**
   * Find the best payment path between two assets using Horizon path finding.
   */
  async findPaymentPaths(
    sourceAccount: string,
    destAsset: Asset,
    destAmount: string,
    limit = 5
  ): Promise<PaymentPath[]> {
    return withRetry(async () => {
      const params = new URLSearchParams({
        source_account: sourceAccount,
        destination_amount: destAmount,
        ...this.prefixParams('destination_', assetToParams(destAsset)),
        limit: String(limit),
      });

      const res = await fetch(`${this.horizonUrl}/paths/strict-receive?${params}`);
      if (!res.ok) throw new Error(`Horizon error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      return (data._embedded?.records ?? []).map((record: any) => ({
        sourceAmount: record.source_amount,
        destinationAmount: record.destination_amount,
        path: (record.path ?? []).map((a: any) => this.parseAsset(a)),
      }));
    }, this.retries);
  }

  /**
   * Execute a path payment (strict receive).
   */
  async executePathPayment(params: PathPaymentParams): Promise<OrderResult> {
    throw new Error(
      'executePathPayment requires Stellar SDK transaction signing. ' +
      'Install @stellar/stellar-sdk and implement PathPaymentStrictReceiveOp.'
    );
  }

  /**
   * Get the current mid-market price for an asset pair.
   * Uses the best bid/ask spread from the order book.
   */
  async getPrice(base: Asset, counter: Asset): Promise<PriceData> {
    const orderBook = await this.getOrderBook(base, counter, 1);

    const bestBid = orderBook.bids[0]?.price ?? '0';
    const bestAsk = orderBook.asks[0]?.price ?? '0';

    const midPrice =
      bestBid === '0' || bestAsk === '0'
        ? bestBid || bestAsk
        : String((parseFloat(bestBid) + parseFloat(bestAsk)) / 2);

    return {
      asset: base,
      price: midPrice,
      timestamp: new Date().toISOString(),
      source: 'orderbook',
    };
  }

  /**
   * Apply slippage tolerance to an amount.
   * Returns the minimum acceptable amount after slippage.
   */
  applySlippage(amount: string, isBuy = false): string {
    const value = parseFloat(amount);
    const factor = isBuy
      ? 1 + this.slippageTolerance
      : 1 - this.slippageTolerance;
    return (value * factor).toFixed(7);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private prefixParams(
    prefix: string,
    params: Record<string, string>
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [`${prefix}${k}`, v])
    );
  }

  private parseAsset(raw: string | { asset_code?: string; asset_issuer?: string }): Asset {
    if (typeof raw === 'string') {
      if (raw === 'native') return { code: 'XLM' };
      const [code, issuer] = raw.split(':');
      return { code, issuer };
    }
    if (!raw.asset_code) return { code: 'XLM' };
    return { code: raw.asset_code, issuer: raw.asset_issuer };
  }
}
