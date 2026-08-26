/**
 * @chenaikit/oracle-node - Telemetry & Metrics Engine
 */

import {
  CircuitState,
  RequestErrorEvent,
  RequestRetryEvent,
  RequestStartEvent,
  RequestSuccessEvent,
  RequestTimeoutEvent,
  TelemetryHooks,
} from "../types.js";

export interface MetricsSnapshot {
  totalRequests: number;
  totalAttempts: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  totalRetries: number;
  timeoutsCount: number;
  rateLimitsCount: number;
  circuitBreakerTrips: number;
  totalDurationMs: number;
  averageDurationMs: number;
}

/**
 * Telemetry and observability engine for the Oracle Node Client
 */
export class TelemetryCollector {
  private hooks: TelemetryHooks;
  private totalRequests = 0;
  private totalAttempts = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private retriedRequests = 0;
  private totalRetries = 0;
  private timeoutsCount = 0;
  private rateLimitsCount = 0;
  private circuitBreakerTrips = 0;
  private totalDurationMs = 0;

  constructor(hooks: TelemetryHooks = {}) {
    this.hooks = { ...hooks };
  }

  public onRequestStart(event: RequestStartEvent): void {
    if (event.attempt === 1) {
      this.totalRequests++;
    }
    this.totalAttempts++;

    try {
      this.hooks.onRequestStart?.(event);
    } catch {
      // Avoid caller hook errors disrupting pipeline
    }
  }

  public onRequestSuccess(event: RequestSuccessEvent): void {
    this.successfulRequests++;
    this.totalDurationMs += event.durationMs;

    try {
      this.hooks.onRequestSuccess?.(event);
    } catch {
      // Suppress hook error
    }
  }

  public onRequestError(event: RequestErrorEvent): void {
    if (!event.willRetry) {
      this.failedRequests++;
      this.totalDurationMs += event.durationMs;
    }

    try {
      this.hooks.onRequestError?.(event);
    } catch {
      // Suppress hook error
    }
  }

  public onRequestRetry(event: RequestRetryEvent): void {
    if (event.attempt === 1) {
      this.retriedRequests++;
    }
    this.totalRetries++;

    try {
      this.hooks.onRequestRetry?.(event);
    } catch {
      // Suppress hook error
    }
  }

  public onRequestTimeout(event: RequestTimeoutEvent): void {
    this.timeoutsCount++;

    try {
      this.hooks.onRequestTimeout?.(event);
    } catch {
      // Suppress hook error
    }
  }

  public onCircuitStateChange(from: CircuitState, to: CircuitState): void {
    if (to === "open") {
      this.circuitBreakerTrips++;
    }

    try {
      this.hooks.onCircuitStateChange?.(from, to);
    } catch {
      // Suppress hook error
    }
  }

  public recordRateLimit(): void {
    this.rateLimitsCount++;
  }

  public getSnapshot(): MetricsSnapshot {
    const avg = this.successfulRequests > 0 ? this.totalDurationMs / this.successfulRequests : 0;

    return {
      totalRequests: this.totalRequests,
      totalAttempts: this.totalAttempts,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      retriedRequests: this.retriedRequests,
      totalRetries: this.totalRetries,
      timeoutsCount: this.timeoutsCount,
      rateLimitsCount: this.rateLimitsCount,
      circuitBreakerTrips: this.circuitBreakerTrips,
      totalDurationMs: this.totalDurationMs,
      averageDurationMs: Math.round(avg * 100) / 100,
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.totalAttempts = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.retriedRequests = 0;
    this.totalRetries = 0;
    this.timeoutsCount = 0;
    this.rateLimitsCount = 0;
    this.circuitBreakerTrips = 0;
    this.totalDurationMs = 0;
  }
}
