import { EventEmitter } from 'events';
import { FraudDetector } from '@chenaikit/core';

// Local type definitions to avoid import resolution issues
export type RiskCategory = 'low' | 'medium' | 'high';

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency?: string;
  timestamp: number;
  merchantId?: string;
  merchantCategory?: string;
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
  deviceId?: string;
  channel?: 'pos' | 'online' | 'atm' | 'transfer';
  ipAddress?: string;
  previousBalance?: number;
}

export interface RiskResult {
  transactionId: string;
  riskScore: number;
  category: RiskCategory;
  reasons: string[];
  latencyMs: number;
  timestamp: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of high-risk transactions to trigger OPEN
  successThreshold: number; // Number of successful transactions to close from HALF_OPEN
  timeoutMs: number; // Time before attempting HALF_OPEN
  monitoringWindowMs: number; // Window for counting failures
  riskScoreThreshold: number; // Risk score threshold (0-100)
}

export interface CircuitBreakerState {
  state: CircuitState;
  lastStateChange: number;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  blockedRequests: number;
  lastRiskScore?: number;
  lastTriggerReason?: string;
  triggerHistory: TriggerEvent[];
}

export interface TriggerEvent {
  timestamp: number;
  fromState: CircuitState;
  toState: CircuitState;
  reason: string;
  riskScore: number;
  transactionId: string;
  explainableFactors: string[];
}

export interface CircuitBreakerDecision {
  allowed: boolean;
  state: CircuitState;
  reason: string;
  riskScore: number;
  explainableFactors: string[];
}

export class CircuitBreakerService extends EventEmitter {
  private state: CircuitState = 'CLOSED';
  private lastStateChange: number = Date.now();
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private blockedRequests: number = 0;
  private triggerHistory: TriggerEvent[] = [];
  private riskHistory: Array<{ timestamp: number; score: number }> = [];
  
  private fraudDetector: FraudDetector;
  private config: CircuitBreakerConfig;

  constructor(fraudDetector: FraudDetector, config?: Partial<CircuitBreakerConfig>) {
    super();
    this.fraudDetector = fraudDetector;
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 3,
      timeoutMs: config?.timeoutMs ?? 60000, // 1 minute
      monitoringWindowMs: config?.monitoringWindowMs ?? 300000, // 5 minutes
      riskScoreThreshold: config?.riskScoreThreshold ?? 70,
    };
  }

  async evaluateTransaction(transaction: Transaction): Promise<CircuitBreakerDecision> {
    this.totalRequests++;
    const now = Date.now();

    // Get risk assessment from fraud detector
    const riskResult = await this.fraudDetector.score(transaction);
    
    // Update risk history
    this.riskHistory.push({ timestamp: now, score: riskResult.riskScore });
    this.trimRiskHistory();

    // Check if we should attempt state transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && now - this.lastStateChange >= this.config.timeoutMs) {
      this.transitionTo('HALF_OPEN', 'Timeout elapsed, attempting recovery', riskResult, transaction.id);
    }

    // Evaluate based on current state
    switch (this.state) {
      case 'CLOSED':
        return this.evaluateClosed(riskResult, transaction);
      case 'OPEN':
        return this.evaluateOpen(riskResult, transaction);
      case 'HALF_OPEN':
        return this.evaluateHalfOpen(riskResult, transaction);
      default:
        throw new Error(`Unknown circuit state: ${this.state}`);
    }
  }

  private evaluateClosed(riskResult: RiskResult, transaction: Transaction): CircuitBreakerDecision {
    const isHighRisk = riskResult.riskScore >= this.config.riskScoreThreshold;
    
    if (isHighRisk) {
      this.failureCount++;
      this.cleanupOldFailures();
      
      if (this.failureCount >= this.config.failureThreshold) {
        const reason = `Failure threshold reached (${this.failureCount}/${this.config.failureThreshold})`;
        this.transitionTo('OPEN', reason, riskResult, transaction.id);
        return {
          allowed: false,
          state: 'OPEN',
          reason: this.buildExplainableReason(riskResult, reason),
          riskScore: riskResult.riskScore,
          explainableFactors: riskResult.reasons,
        };
      }
    } else {
      this.successCount++;
    }

    return {
      allowed: true,
      state: 'CLOSED',
      reason: this.buildExplainableReason(riskResult, 'Normal operation'),
      riskScore: riskResult.riskScore,
      explainableFactors: riskResult.reasons,
    };
  }

  private evaluateOpen(riskResult: RiskResult, transaction: Transaction): CircuitBreakerDecision {
    this.blockedRequests++;
    
    return {
      allowed: false,
      state: 'OPEN',
      reason: this.buildExplainableReason(riskResult, 'Circuit is OPEN - blocking high-risk transactions'),
      riskScore: riskResult.riskScore,
      explainableFactors: riskResult.reasons,
    };
  }

  private evaluateHalfOpen(riskResult: RiskResult, transaction: Transaction): CircuitBreakerDecision {
    const isHighRisk = riskResult.riskScore >= this.config.riskScoreThreshold;
    
    if (isHighRisk) {
      this.failureCount++;
      const reason = `High-risk transaction in HALF_OPEN state (score: ${riskResult.riskScore})`;
      this.transitionTo('OPEN', reason, riskResult, transaction.id);
      return {
        allowed: false,
        state: 'OPEN',
        reason: this.buildExplainableReason(riskResult, reason),
        riskScore: riskResult.riskScore,
        explainableFactors: riskResult.reasons,
      };
    } else {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        const reason = `Success threshold reached (${this.successCount}/${this.config.successThreshold})`;
        this.transitionTo('CLOSED', reason, riskResult, transaction.id);
        this.resetCounts();
      }
      
      return {
        allowed: true,
        state: 'HALF_OPEN',
        reason: this.buildExplainableReason(riskResult, 'Testing recovery in HALF_OPEN state'),
        riskScore: riskResult.riskScore,
        explainableFactors: riskResult.reasons,
      };
    }
  }

  private transitionTo(newState: CircuitState, reason: string, riskResult: RiskResult, transactionId: string) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    const triggerEvent: TriggerEvent = {
      timestamp: Date.now(),
      fromState: oldState,
      toState: newState,
      reason,
      riskScore: riskResult.riskScore,
      transactionId,
      explainableFactors: riskResult.reasons,
    };
    
    this.triggerHistory.push(triggerEvent);
    if (this.triggerHistory.length > 100) {
      this.triggerHistory.shift();
    }
    
    this.emit('stateChange', triggerEvent);
  }

  private buildExplainableReason(riskResult: RiskResult, baseReason: string): string {
    const factors = riskResult.reasons.slice(0, 3).join(', ');
    return `${baseReason}. Risk factors: ${factors}`;
  }

  private cleanupOldFailures() {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindowMs;
    
    // Keep only recent failures in risk history
    this.riskHistory = this.riskHistory.filter(r => r.timestamp >= windowStart);
    
    // Recalculate failure count based on recent high-risk transactions
    this.failureCount = this.riskHistory.filter(r => r.score >= this.config.riskScoreThreshold).length;
  }

  private trimRiskHistory() {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindowMs;
    this.riskHistory = this.riskHistory.filter(r => r.timestamp >= windowStart);
    if (this.riskHistory.length > 1000) {
      this.riskHistory = this.riskHistory.slice(-1000);
    }
  }

  private resetCounts() {
    this.failureCount = 0;
    this.successCount = 0;
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      lastStateChange: this.lastStateChange,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      lastRiskScore: this.riskHistory[this.riskHistory.length - 1]?.score,
      lastTriggerReason: this.triggerHistory[this.triggerHistory.length - 1]?.reason,
      triggerHistory: this.triggerHistory,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.lastStateChange = Date.now();
    this.resetCounts();
    this.triggerHistory = [];
    this.riskHistory = [];
    this.emit('reset');
  }

  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  getMetrics() {
    return {
      state: this.state,
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      failureCount: this.failureCount,
      successCount: this.successCount,
      blockRate: this.totalRequests > 0 ? this.blockedRequests / this.totalRequests : 0,
      avgRiskScore: this.riskHistory.length > 0 
        ? this.riskHistory.reduce((sum, r) => sum + r.score, 0) / this.riskHistory.length 
        : 0,
      triggerCount: this.triggerHistory.length,
    };
  }
}
