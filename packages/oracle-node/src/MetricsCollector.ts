import { OracleConfig, OracleMetrics } from './types';

export class MetricsCollector {
  private config: OracleConfig;
  private metrics: OracleMetrics;
  private startTime: number;
  private responseTimes: number[] = [];
  private isCollecting: boolean = false;
  private collectionInterval?: ReturnType<typeof setInterval>;

  constructor(config: OracleConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.metrics = {
      nodeId: config.nodeKeypair.publicKey,
      uptime: 0,
      totalRequests: 0,
      successfulSubmissions: 0,
      failedSubmissions: 0,
      averageResponseTime: 0,
      currentReputation: 1000, // Starting reputation
    };
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.startTime = Date.now();

    // Update uptime periodically
    this.collectionInterval = setInterval(() => {
      this.metrics.uptime = Date.now() - this.startTime;
    }, 1000);

    console.log('Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    console.log('Metrics collection stopped');
  }

  /**
   * Record a successful submission
   */
  recordSuccessfulSubmission(responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulSubmissions++;
    this.responseTimes.push(responseTime);
    this.metrics.lastSubmissionTime = Date.now();

    // Update average response time
    this.updateAverageResponseTime();

    console.log(`Successful submission recorded (response time: ${responseTime}ms)`);
  }

  /**
   * Record a failed submission
   */
  recordFailedSubmission(): void {
    this.metrics.totalRequests++;
    this.metrics.failedSubmissions++;

    console.log('Failed submission recorded');
  }

  /**
   * Update reputation score
   */
  updateReputation(delta: number): void {
    this.metrics.currentReputation = Math.max(0, this.metrics.currentReputation + delta);
    console.log(`Reputation updated: ${this.metrics.currentReputation} (delta: ${delta})`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): OracleMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    successRate: number;
    averageResponseTime: number;
    uptime: number;
    reputation: number;
  } {
    const successRate = this.metrics.totalRequests > 0
      ? (this.metrics.successfulSubmissions / this.metrics.totalRequests) * 100
      : 0;

    return {
      successRate,
      averageResponseTime: this.metrics.averageResponseTime,
      uptime: this.metrics.uptime,
      reputation: this.metrics.currentReputation,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      nodeId: this.config.nodeKeypair.publicKey,
      uptime: 0,
      totalRequests: 0,
      successfulSubmissions: 0,
      failedSubmissions: 0,
      averageResponseTime: 0,
      currentReputation: this.metrics.currentReputation,
    };
    this.responseTimes = [];
    this.startTime = Date.now();

    console.log('Metrics reset');
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) {
      this.metrics.averageResponseTime = 0;
      return;
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;

    // Keep only last 100 response times to avoid memory issues
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }
}
