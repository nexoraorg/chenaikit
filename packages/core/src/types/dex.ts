/**
 * DEX types for Stellar order book and liquidity pool operations.
 */

export interface DexConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
  slippageTolerance?: number; // 0.0 - 1.0, default 0.01 (1%)
  retries?: number;
}

export interface Asset {
  code: string;
  issuer?: string; // undefined = XLM native
}

export interface OrderBookOffer {
  price: string;
  priceR: { n: number; d: number };
  amount: string;
}

export interface OrderBook {
  base: Asset;
  counter: Asset;
  bids: OrderBookOffer[];
  asks: OrderBookOffer[];
  timestamp: string;
}

export interface TradeOffer {
  id: string;
  offerId: string;
  baseAccount: string;
  baseAmount: string;
  baseAsset: Asset;
  counterAmount: string;
  counterAsset: Asset;
  price: string;
  timestamp: string;
}

export interface PlaceOrderParams {
  sourceAccount: string;
  sourceSecret: string;
  selling: Asset;
  buying: Asset;
  amount: string;
  price: string;
  offerId?: string; // 0 = new offer, >0 = update existing
}

export interface OrderResult {
  success: boolean;
  transactionHash: string;
  offerId?: string;
  error?: string;
}

export interface LiquidityPool {
  id: string;
  fee: number;
  assetA: Asset;
  assetB: Asset;
  reserveA: string;
  reserveB: string;
  totalShares: string;
  totalTrustlines: number;
}

export interface LiquidityPoolDepositParams {
  sourceAccount: string;
  sourceSecret: string;
  poolId: string;
  maxAmountA: string;
  maxAmountB: string;
  minPrice: string;
  maxPrice: string;
}

export interface LiquidityPoolWithdrawParams {
  sourceAccount: string;
  sourceSecret: string;
  poolId: string;
  amount: string;
  minAmountA: string;
  minAmountB: string;
}

export interface PathPaymentParams {
  sourceAccount: string;
  sourceSecret: string;
  sendAsset: Asset;
  sendMax: string;
  destination: string;
  destAsset: Asset;
  destAmount: string;
  path?: Asset[];
}

export interface PaymentPath {
  sourceAmount: string;
  destinationAmount: string;
  path: Asset[];
}

export interface DexTrade {
  id: string;
  offerId: string;
  baseAccount: string;
  baseAmount: string;
  baseAsset: Asset;
  counterAmount: string;
  counterAsset: Asset;
  price: string;
  timestamp: string;
}

export interface DexStats {
  asset: Asset;
  baseVolume: string;
  counterVolume: string;
  tradeCount: number;
  open: string;
  high: string;
  low: string;
  close: string;
  timestamp: string;
}

export interface PriceData {
  asset: Asset;
  price: string;
  timestamp: string;
  source: 'orderbook' | 'pool';
}
