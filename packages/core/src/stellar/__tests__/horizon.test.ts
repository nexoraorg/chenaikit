import { HorizonConnector, HorizonConfig } from '../horizon';

// Test configuration for Stellar testnet
const testConfig: HorizonConfig = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rateLimit: {
    requestsPerMinute: 60,
    burstLimit: 10,
    retryAfterMs: 1000
  },
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Known testnet accounts for testing
const TEST_ACCOUNTS = {
  // Stellar Development Foundation test account
  SDF: 'GALPCCZN4YXA3YMJHKL6CVIECKPLJJCTVMSNYWBTKJW4K5HQLYLDMZ3J',
  // Test account with some activity
  ACTIVE: 'GCLRUZDCWBHS7VIFCT43BYPPGWDNSN6FJT5C4KEOME7FVY3ZW7X5C3M2',
  // Non-existent account for error testing
  INVALID: 'INVALID_ADDRESS_FORMAT'
};

describe('HorizonConnector', () => {
  let horizon: HorizonConnector;

  beforeAll(() => {
    horizon = new HorizonConnector(testConfig);
  });

  afterAll(() => {
    horizon.stopStreaming();
  });

  describe('Health Check', () => {
    it('should connect to Horizon API successfully', async () => {
      const isHealthy = await horizon.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Network Info', () => {
    it('should fetch network information', async () => {
      const networkInfo = await horizon.getNetworkInfo();
      expect(networkInfo).toBeDefined();
      expect(networkInfo.network_passphrase).toBe(testConfig.networkPassphrase);
    });

    it('should fetch fee statistics', async () => {
      const feeStats = await horizon.getFeeStats();
      expect(feeStats).toBeDefined();
      expect(feeStats.last_ledger).toBeDefined();
      expect(feeStats.last_ledger_base_fee).toBeDefined();
    });
  });

  describe('Account Operations', () => {
    it('should fetch account data for valid address', async () => {
      const account = await horizon.getAccount(TEST_ACCOUNTS.SDF);
      
      expect(account).toBeDefined();
      expect(account.id).toBe(TEST_ACCOUNTS.SDF);
      expect(account.account_id).toBe(TEST_ACCOUNTS.SDF);
      expect(account.sequence).toBeDefined();
      expect(account.balances).toBeInstanceOf(Array);
      expect(account.signers).toBeInstanceOf(Array);
    });

    it('should fetch account balances', async () => {
      const balances = await horizon.getAccountBalances(TEST_ACCOUNTS.SDF);
      
      expect(balances).toBeInstanceOf(Array);
      expect(balances.length).toBeGreaterThan(0);
      
      // Check for XLM balance
      const xlmBalance = balances.find(b => b.asset_type === 'native');
      expect(xlmBalance).toBeDefined();
      expect(xlmBalance?.balance).toBeDefined();
    });

    it('should throw error for invalid address format', async () => {
      await expect(horizon.getAccount(TEST_ACCOUNTS.INVALID))
        .rejects.toThrow('Invalid Stellar address format');
    });

    it('should throw error for non-existent account', async () => {
      const nonExistentAccount = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      await expect(horizon.getAccount(nonExistentAccount))
        .rejects.toThrow('Account not found');
    });
  });

  describe('Transaction History', () => {
    it('should fetch account transactions with pagination', async () => {
      const result = await horizon.getAccountTransactions(TEST_ACCOUNTS.SDF, {
        limit: 5,
        order: 'desc'
      });

      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      expect(result.records.length).toBeLessThanOrEqual(5);
      
      if (result.records.length > 0) {
        const transaction = result.records[0];
        expect(transaction.id).toBeDefined();
        expect(transaction.hash).toBeDefined();
        expect(transaction.source_account).toBeDefined();
        expect(transaction.successful).toBeDefined();
      }
    });

    it('should fetch account payments', async () => {
      const result = await horizon.getAccountPayments(TEST_ACCOUNTS.SDF, {
        limit: 5,
        order: 'desc'
      });

      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      
      // All records should be payment operations
      result.records.forEach(operation => {
        expect(operation.type).toBe('payment');
        expect(operation.from).toBeDefined();
        expect(operation.to).toBeDefined();
        expect(operation.amount).toBeDefined();
      });
    });

    it('should handle pagination correctly', async () => {
      const firstPage = await horizon.getAccountTransactions(TEST_ACCOUNTS.SDF, {
        limit: 2,
        order: 'desc'
      });

      expect(firstPage.records.length).toBeLessThanOrEqual(2);
      
      if (firstPage.next) {
        // Test that we can get the next page
        const nextPage = await horizon.getAccountTransactions(TEST_ACCOUNTS.SDF, {
          cursor: firstPage.records[firstPage.records.length - 1].paging_token,
          limit: 2,
          order: 'desc'
        });
        
        expect(nextPage.records).toBeInstanceOf(Array);
        expect(nextPage.records.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Transaction Details', () => {
    let testTransactionHash: string;

    beforeAll(async () => {
      // Get a transaction hash from the test account
      const transactions = await horizon.getAccountTransactions(TEST_ACCOUNTS.SDF, { limit: 1 });
      if (transactions.records.length > 0) {
        testTransactionHash = transactions.records[0].hash;
      }
    });

    it('should fetch transaction by hash', async () => {
      if (!testTransactionHash) {
        console.warn('No test transaction found, skipping test');
        return;
      }

      const transaction = await horizon.getTransaction(testTransactionHash);
      
      expect(transaction).toBeDefined();
      expect(transaction.hash).toBe(testTransactionHash);
      expect(transaction.id).toBeDefined();
      expect(transaction.source_account).toBeDefined();
      expect(transaction.successful).toBeDefined();
    });

    it('should fetch transaction operations', async () => {
      if (!testTransactionHash) {
        console.warn('No test transaction found, skipping test');
        return;
      }

      const result = await horizon.getTransactionOperations(testTransactionHash);
      
      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      
      result.records.forEach(operation => {
        expect(operation.id).toBeDefined();
        expect(operation.type).toBeDefined();
        expect(operation.transaction_hash).toBe(testTransactionHash);
      });
    });

    it('should fetch transaction effects', async () => {
      if (!testTransactionHash) {
        console.warn('No test transaction found, skipping test');
        return;
      }

      const result = await horizon.getTransactionEffects(testTransactionHash);
      
      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      
      result.records.forEach(effect => {
        expect(effect.id).toBeDefined();
        expect(effect.type).toBeDefined();
        expect(effect.account).toBeDefined();
      });
    });

    it('should throw error for invalid transaction hash', async () => {
      await expect(horizon.getTransaction('invalid_hash'))
        .rejects.toThrow('Invalid transaction hash format');
    });

    it('should throw error for non-existent transaction', async () => {
      const nonExistentHash = 'a'.repeat(64); // Valid format but non-existent
      await expect(horizon.getTransaction(nonExistentHash))
        .rejects.toThrow('Transaction not found');
    });
  });

  describe('Ledger Operations', () => {
    it('should fetch recent ledgers', async () => {
      const result = await horizon.getLedgers({ limit: 5, order: 'desc' });
      
      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      expect(result.records.length).toBeLessThanOrEqual(5);
      
      if (result.records.length > 0) {
        const ledger = result.records[0];
        expect(ledger.id).toBeDefined();
        expect(ledger.sequence).toBeDefined();
        expect(ledger.hash).toBeDefined();
        expect(ledger.closed_at).toBeDefined();
      }
    });

    it('should fetch specific ledger by sequence', async () => {
      // Get a recent ledger first
      const recentLedgers = await horizon.getLedgers({ limit: 1, order: 'desc' });
      
      if (recentLedgers.records.length > 0) {
        const ledgerSequence = recentLedgers.records[0].sequence;
        const ledger = await horizon.getLedger(ledgerSequence);
        
        expect(ledger).toBeDefined();
        expect(ledger.sequence).toBe(ledgerSequence);
        expect(ledger.hash).toBeDefined();
        expect(ledger.closed_at).toBeDefined();
      }
    });

    it('should throw error for non-existent ledger', async () => {
      await expect(horizon.getLedger(999999999))
        .rejects.toThrow('Ledger not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const invalidHorizon = new HorizonConnector({
        horizonUrl: 'https://invalid-horizon-url.com',
        networkPassphrase: 'Test Network',
        timeout: 1000
      });

      await expect(invalidHorizon.healthCheck())
        .resolves.toBe(false);
    });

    it('should handle rate limiting', async () => {
      const rateLimitedHorizon = new HorizonConnector({
        ...testConfig,
        rateLimit: {
          requestsPerMinute: 1,
          burstLimit: 1,
          retryAfterMs: 100
        }
      });

      // Make multiple requests quickly to trigger rate limiting
      const promises = Array(3).fill(null).map(() => 
        rateLimitedHorizon.getNetworkInfo()
      );

      // Should not throw errors due to built-in retry logic
      await expect(Promise.all(promises))
        .resolves.toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should return properly typed account data', async () => {
      const account = await horizon.getAccount(TEST_ACCOUNTS.SDF);
      
      // TypeScript should infer these types correctly
      expect(typeof account.id).toBe('string');
      expect(typeof account.sequence).toBe('string');
      expect(Array.isArray(account.balances)).toBe(true);
      expect(Array.isArray(account.signers)).toBe(true);
      
      // Check balance structure
      if (account.balances.length > 0) {
        const balance = account.balances[0];
        expect(typeof balance.balance).toBe('string');
        expect(typeof balance.asset_type).toBe('string');
      }
    });

    it('should return properly typed transaction data', async () => {
      const result = await horizon.getAccountTransactions(TEST_ACCOUNTS.SDF, { limit: 1 });
      
      if (result.records.length > 0) {
        const transaction = result.records[0];
        expect(typeof transaction.id).toBe('string');
        expect(typeof transaction.hash).toBe('string');
        expect(typeof transaction.successful).toBe('boolean');
        expect(typeof transaction.source_account).toBe('string');
        expect(Array.isArray(transaction.operations)).toBe(true);
        expect(Array.isArray(transaction.effects)).toBe(true);
      }
    });
  });

  describe('Streaming (Mock)', () => {
    it('should handle account streaming setup', async () => {
      const callback = jest.fn();
      
      // Start streaming (this will poll once and then set up interval)
      const streamPromise = horizon.streamAccount(TEST_ACCOUNTS.SDF, callback);
      
      // Wait a bit for the first callback
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stop streaming
      horizon.stopStreaming();
      
      // Wait for cleanup
      await streamPromise;
      
      // Should have been called at least once
      expect(callback).toHaveBeenCalled();
    });
  });
});
