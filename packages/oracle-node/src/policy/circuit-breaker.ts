/**
 * @chenaikit/oracle-node - Circuit Breaker Pattern
 */

import { OracleCircuitBreakerError } from "../errors.js";
import { CircuitBreakerOptions, CircuitState } from "../types.js";

export const DEFAULT_FAILURE_THRESHOLD = 5;
export const DEFAULT_COOLDOWN_PERIOD_MS = 30000;
export const DEFAULT_SUCCESS_THRESHOLD = 2;

/**
 * Circuit Breaker state machine protecting downstream oracle nodes from overload
 */
export class CircuitBreaker {
  public readonly enabled: boolean;
  public readonly failureThreshold: number;
  public readonly cooldownPeriodMs: number;
  public readonly successThreshold: number;

  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastStateChangeTime: number = Date.now();
  private stateChangeListeners: Array<(from: CircuitState, to: CircuitState) => void> = [];

  constructor(options: CircuitBreakerOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? DEFAULT_COOLDOWN_PERIOD_MS;
    this.successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
  }

  public getState(): CircuitState {
    if (!this.enabled) return "closed";

    if (this.state === "open") {
      const now = Date.now();
      if (now - this.lastStateChangeTime >= this.cooldownPeriodMs) {
        this.transitionTo("half-open");
      }
    }

    return this.state;
  }

  public onStateChange(listener: (from: CircuitState, to: CircuitState) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Checks whether a request is allowed through the circuit
   * @throws OracleCircuitBreakerError if the circuit is open
   */
  public checkAllowance(): void {
    if (!this.enabled) return;

    const currentState = this.getState();
    if (currentState === "open") {
      const elapsed = Date.now() - this.lastStateChangeTime;
      const remaining = Math.max(0, this.cooldownPeriodMs - elapsed);
      throw new OracleCircuitBreakerError(
        `Oracle node circuit breaker is OPEN. Fast-failing request. Retry in ${remaining}ms`,
        remaining
      );
    }
  }

  /**
   * Records a successful operation execution
   */
  public recordSuccess(): void {
    if (!this.enabled) return;

    const currentState = this.getState();

    if (currentState === "half-open") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
        this.transitionTo("closed");
      }
    } else if (currentState === "closed") {
      this.failureCount = 0;
    }
  }

  /**
   * Records a failed operation execution
   */
  public recordFailure(): void {
    if (!this.enabled) return;

    const currentState = this.getState();

    if (currentState === "half-open") {
      // Any failure during trial immediately re-trips to open
      this.transitionTo("open");
    } else if (currentState === "closed") {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo("open");
      }
    }
  }

  /**
   * Reset internal counters
   */
  public reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Force transition to a specific state (useful for testing or manual intervention)
   */
  public forceState(target: CircuitState): void {
    this.transitionTo(target);
  }

  private transitionTo(nextState: CircuitState): void {
    if (this.state === nextState) return;

    const prev = this.state;
    this.state = nextState;
    this.lastStateChangeTime = Date.now();
    this.reset();

    for (const listener of this.stateChangeListeners) {
      try {
        listener(prev, nextState);
      } catch {
        // Suppress listener errors
      }
    }
  }
}
