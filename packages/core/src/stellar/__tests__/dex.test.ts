import { DexConnector, withRetry } from '../dex';
import { Asset, DexConfig } from '../../types/dex';

// Mock fetch globally
global.fetch = jest.fn();

describe('DexConnector', () => {
  let dex: DexConnector;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    const config: DexConfig = {
      network: 'testnet',
      slippageTolerance: 0.01,
      retries: 2,
    };
    dex = new DexConnector(config);
  });

  describe('getOrderBook', () => {
    it('should fetch order book successfully', async () => {
      const mockOrderBook = {
        bids: [{ price: '1.5', amount: '100' }],
        asks: [{ price: '1.6', amount: '200' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderBook,
      } as Response);

      const base: Asset = { code: 'XLM' };
      const counter: Asset = { code: 'USDC', issuer: 'ISSUER123' };

      const result = await dex.getOrderBook(base, counter);

      expect(result.bids).toEqual(mockOrderBook.bids);
      expect(result.asks).toEqual(mockOrderBook.asks);
      expect(result.base).toEqual(base);
      expect(result.counter).toEqual(counter);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const base: Asset = { code: 'XLM' };
      const counter: Asset = { code: 'USDC', issuer: 'ISSUER123' };

      await expect(dex.getOrderBook(base, counter)).rejects.toThrow('Horizon error');
    });
  });

  describe('getLiquidityPool', () => {
    it('should fetch liquidity pool details', async () => {
      const mockPool = {
        id: 'pool123',
        fee_bp: 30,
        reserves: [
          { asset: 'native', amount: '1000' },
          { asset_code: 'USDC', asset_issuer: 'ISSUER', amount: '2000' },
        ],
        total_shares: '5000',
        total_trustlines: 100,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPool,
      } as Response);

      const result = await dex.getLiquidityPool('pool123');

      expect(result.id).toBe('pool123');
      expect(result.fee).toBe(0.003);
      expect(result.reserveA).toBe('1000');
      expect(result.reserveB).toBe('2000');
    });
  });

  describe('listLiquidityPools', () => {
    it('should list liquidity pools', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              id: 'pool1',
              fee_bp: 30,
              reserves: [
                { asset: 'native', amount: '1000' },
                { asset_code: 'USDC', asset_issuer: 'ISSUER', amount: '2000' },
              ],
              total_shares: '5000',
              total_trustlines: 100,
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await dex.listLiquidityPools();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pool1');
    });
  });

  describe('findPaymentPaths', () => {
    it('should find payment paths', async () => {
      const mockPaths = {
        _embedded: {
          records: [
            {
              source_amount: '100',
              destination_amount: '95',
              path: [{ asset_code: 'USDC', asset_issuer: 'ISSUER' }],
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaths,
      } as Response);

      const destAsset: Asset = { code: 'EUR', issuer: 'ISSUER' };
      const result = await dex.findPaymentPaths('ACCOUNT123', destAsset, '100');

      expect(result).toHaveLength(1);
      expect(result[0].sourceAmount).toBe('100');
      expect(result[0].destinationAmount).toBe('95');
    });
  });

  describe('getPrice', () => {
    it('should calculate mid-market price', async () => {
      const mockOrderBook = {
        bids: [{ price: '1.5', amount: '100' }],
        asks: [{ price: '1.6', amount: '200' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderBook,
      } as Response);

      const base: Asset = { code: 'XLM' };
      const counter: Asset = { code: 'USDC', issuer: 'ISSUER' };

      const result = await dex.getPrice(base, counter);

      expect(parseFloat(result.price)).toBeCloseTo(1.55, 2);
      expect(result.source).toBe('orderbook');
    });
  });

  describe('applySlippage', () => {
    it('should apply slippage for sell orders', () => {
      const result = dex.applySlippage('100', false);
      expect(parseFloat(result)).toBe(99);
    });

    it('should apply slippage for buy orders', () => {
      const result = dex.applySlippage('100', true);
      expect(parseFloat(result)).toBe(101);
    });
  });

  describe('placeOrder', () => {
    it('should throw not implemented error', async () => {
      await expect(
        dex.placeOrder({
          sourceAccount: 'ACCOUNT',
          sourceSecret: 'SECRET',
          selling: { code: 'XLM' },
          buying: { code: 'USDC', issuer: 'ISSUER' },
          amount: '100',
          price: '1.5',
        })
      ).rejects.toThrow('requires Stellar SDK');
    });
  });
});

describe('withRetry', () => {
  it('should succeed on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 3);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, 3);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, 2)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
