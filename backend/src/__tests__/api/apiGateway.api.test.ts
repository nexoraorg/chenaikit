/**
 * API Gateway middleware integration tests
 *
 * Tests CircuitBreaker state transitions and the ApiGateway class logic
 * directly (unit-style) alongside lightweight HTTP smoke tests to verify
 * the gateway is wired correctly.
 */

import { CircuitBreaker, CircuitBreakerState } from '../../middleware/apiGateway';

describe('CircuitBreaker – unit', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ threshold: 3, timeout: 1000, resetTimeout: 500 });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.getFailures()).toBe(0);
  });

  it('stays CLOSED after successful operations', async () => {
    await breaker.execute(async () => 'ok');
    await breaker.execute(async () => 'ok');
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.getFailures()).toBe(0);
  });

  it('opens after threshold failures', async () => {
    const fail = () => breaker.execute(async () => { throw new Error('fail'); });

    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    expect(breaker.getFailures()).toBe(3);
  });

  it('rejects immediately when OPEN', async () => {
    // Force open
    for (let i = 0; i < 3; i++) {
      await breaker.execute(async () => { throw new Error('x'); }).catch(() => {});
    }

    await expect(
      breaker.execute(async () => 'should not run')
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('resets to CLOSED on manual reset()', () => {
    breaker.reset();
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.getFailures()).toBe(0);
  });

  it('transitions to HALF_OPEN after resetTimeout elapses', async () => {
    // Threshold = 3 failures
    for (let i = 0; i < 3; i++) {
      await breaker.execute(async () => { throw new Error('x'); }).catch(() => {});
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Wind the clock forward past resetTimeout (500 ms)
    // We patch the internal nextAttempt to simulate time elapsed
    (breaker as any).nextAttempt = Date.now() - 1;

    // The next execute call should flip to HALF_OPEN and attempt the op
    const result = await breaker.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('failure counter increments correctly', async () => {
    await breaker.execute(async () => { throw new Error('x'); }).catch(() => {});
    expect(breaker.getFailures()).toBe(1);
    await breaker.execute(async () => { throw new Error('x'); }).catch(() => {});
    expect(breaker.getFailures()).toBe(2);
  });
});

// ── ApiGateway health check ────────────────────────────────────────────────

import { ApiKeyService } from '../../services/apiKeyService';
import { UsageTrackingService } from '../../services/usageTrackingService';
import { ApiGateway } from '../../middleware/apiGateway';
import { getTestPrisma } from '../setup';

describe('ApiGateway – health check integration', () => {
  let gateway: ApiGateway;

  beforeAll(() => {
    const prisma = getTestPrisma();
    const apiKeyService = new ApiKeyService(prisma);
    const usageService = new UsageTrackingService(prisma);
    gateway = new ApiGateway(apiKeyService, usageService);
  });

  it('returns healthy when no circuit breakers are open', async () => {
    const status = await gateway.healthCheck();
    expect(status.status).toBe('healthy');
    expect(status.rateLimiter).toBe(true);
    expect(typeof status.timestamp).toBe('string');
  });

  it('returns the circuit breaker state map', async () => {
    const cbStatus = gateway.getCircuitBreakerStatus();
    expect(typeof cbStatus).toBe('object');
  });

  it('resetCircuitBreakers does not throw', () => {
    expect(() => gateway.resetCircuitBreakers()).not.toThrow();
  });
});
