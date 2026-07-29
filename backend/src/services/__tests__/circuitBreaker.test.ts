import { CircuitBreakerService, CircuitState, Transaction } from '../circuitBreakerService';

// Mock FraudDetector
class MockFraudDetector {
  async score(transaction: Transaction) {
    // Return a mock risk result based on transaction amount
    const riskScore = transaction.amount > 1000 ? 80 : 30;
    return {
      transactionId: transaction.id,
      riskScore,
      category: riskScore >= 70 ? 'high' : 'low',
      reasons: riskScore >= 70 ? ['High amount', 'Unusual pattern'] : ['Normal pattern'],
      latencyMs: 10,
      timestamp: Date.now(),
    };
  }
}

describe('CircuitBreakerService', () => {
  let circuitBreaker: CircuitBreakerService;
  let mockFraudDetector: MockFraudDetector;

  beforeEach(() => {
    mockFraudDetector = new MockFraudDetector();
    circuitBreaker = new CircuitBreakerService(mockFraudDetector as any, {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
      monitoringWindowMs: 5000,
      riskScoreThreshold: 70,
    });
  });

  afterEach(() => {
    circuitBreaker.reset();
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
    });

    it('should have zero counts initially', () => {
      const state = circuitBreaker.getState();
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.totalRequests).toBe(0);
    });
  });

  describe('CLOSED State', () => {
    it('should allow low-risk transactions', async () => {
      const transaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      const decision = await circuitBreaker.evaluateTransaction(transaction);
      expect(decision.allowed).toBe(true);
      expect(decision.state).toBe('CLOSED');
    });

    it('should allow high-risk transactions but increment failure count', async () => {
      const transaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      const decision = await circuitBreaker.evaluateTransaction(transaction);
      expect(decision.allowed).toBe(true);
      expect(decision.state).toBe('CLOSED');
      expect(circuitBreaker.getState().failureCount).toBe(1);
    });

    it('should transition to OPEN after failure threshold is reached', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Send 3 high-risk transactions (threshold is 3)
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
    });
  });

  describe('OPEN State', () => {
    it('should block all transactions when OPEN', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      // Try a low-risk transaction
      const lowRiskTransaction: Transaction = {
        id: 'tx_low',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      const decision = await circuitBreaker.evaluateTransaction(lowRiskTransaction);
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe('OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      // Wait for timeout (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Send a transaction to trigger state check
      const transaction: Transaction = {
        id: 'tx_after_timeout',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      await circuitBreaker.evaluateTransaction(transaction);
      const state = circuitBreaker.getState();
      expect(state.state).toBe('HALF_OPEN');
    });
  });

  describe('HALF_OPEN State', () => {
    it('should allow transactions in HALF_OPEN state', async () => {
      // First, get to OPEN state
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger HALF_OPEN
      const lowRiskTransaction: Transaction = {
        id: 'tx_low',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      const decision = await circuitBreaker.evaluateTransaction(lowRiskTransaction);
      expect(decision.allowed).toBe(true);
      expect(decision.state).toBe('HALF_OPEN');
    });

    it('should transition back to OPEN on high-risk transaction', async () => {
      // Get to OPEN then HALF_OPEN
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      const lowRiskTransaction: Transaction = {
        id: 'tx_low',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      await circuitBreaker.evaluateTransaction(lowRiskTransaction);

      // Send a high-risk transaction in HALF_OPEN
      const decision = await circuitBreaker.evaluateTransaction(highRiskTransaction);
      expect(decision.allowed).toBe(false);
      expect(circuitBreaker.getState().state).toBe('OPEN');
    });

    it('should transition to CLOSED after success threshold', async () => {
      // Get to OPEN then HALF_OPEN
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Send 2 successful transactions (threshold is 2)
      const lowRiskTransaction: Transaction = {
        id: 'tx_low',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      await circuitBreaker.evaluateTransaction({ ...lowRiskTransaction, id: 'tx1' });
      await circuitBreaker.evaluateTransaction({ ...lowRiskTransaction, id: 'tx2' });

      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
    });
  });

  describe('Explainable Factors', () => {
    it('should include explainable factors in decision', async () => {
      const transaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      const decision = await circuitBreaker.evaluateTransaction(transaction);
      expect(decision.explainableFactors).toBeDefined();
      expect(decision.explainableFactors.length).toBeGreaterThan(0);
    });

    it('should include trigger reasons in history', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      const state = circuitBreaker.getState();
      expect(state.triggerHistory.length).toBeGreaterThan(0);
      expect(state.triggerHistory[0].explainableFactors).toBeDefined();
    });
  });

  describe('Metrics', () => {
    it('should track total requests', async () => {
      const transaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 100,
        timestamp: Date.now(),
      };

      await circuitBreaker.evaluateTransaction(transaction);
      await circuitBreaker.evaluateTransaction({ ...transaction, id: 'tx2' });

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track blocked requests', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      // Try to send more transactions while OPEN
      await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: 'tx4' });
      await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: 'tx5' });

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.blockedRequests).toBeGreaterThan(0);
    });

    it('should calculate block rate', async () => {
      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      // Try to send more transactions while OPEN
      await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: 'tx4' });

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.blockRate).toBeGreaterThan(0);
      expect(metrics.blockRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration', () => {
    it('should allow updating configuration', () => {
      const newConfig = {
        failureThreshold: 10,
        successThreshold: 5,
      };

      circuitBreaker.updateConfig(newConfig);
      const config = circuitBreaker.getConfig();

      expect(config.failureThreshold).toBe(10);
      expect(config.successThreshold).toBe(5);
    });

    it('should preserve other config values when updating', () => {
      const originalConfig = circuitBreaker.getConfig();
      
      circuitBreaker.updateConfig({ failureThreshold: 10 });
      const newConfig = circuitBreaker.getConfig();

      expect(newConfig.failureThreshold).toBe(10);
      expect(newConfig.successThreshold).toBe(originalConfig.successThreshold);
      expect(newConfig.timeoutMs).toBe(originalConfig.timeoutMs);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      const transaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Generate some activity
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.evaluateTransaction({ ...transaction, id: `tx${i}` });
      }

      circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
      expect(state.triggerHistory).toHaveLength(0);
    });
  });

  describe('State Change Events', () => {
    it('should emit state change events', async () => {
      const stateChangeSpy = jest.fn();
      circuitBreaker.on('stateChange', stateChangeSpy);

      const highRiskTransaction: Transaction = {
        id: 'tx1',
        accountId: 'acc1',
        amount: 2000,
        timestamp: Date.now(),
      };

      // Trigger OPEN state
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.evaluateTransaction({ ...highRiskTransaction, id: `tx${i}` });
      }

      expect(stateChangeSpy).toHaveBeenCalled();
      const event = stateChangeSpy.mock.calls[0][0];
      expect(event.fromState).toBe('CLOSED');
      expect(event.toState).toBe('OPEN');
    });

    it('should emit reset event', () => {
      const resetSpy = jest.fn();
      circuitBreaker.on('reset', resetSpy);

      circuitBreaker.reset();
      expect(resetSpy).toHaveBeenCalled();
    });
  });
});
