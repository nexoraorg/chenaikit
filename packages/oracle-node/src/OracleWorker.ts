import { OracleConfig, ModelInferenceRequest, ModelInferenceResult } from './types';
import { CommitRevealManager } from './CommitRevealManager';
import { MetricsCollector } from './MetricsCollector';

export class OracleWorker {
  private config: OracleConfig;
  private commitRevealManager: CommitRevealManager;
  private metricsCollector: MetricsCollector;
  private isRunning: boolean = false;
  private driftCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: OracleConfig) {
    this.config = config;
    this.commitRevealManager = new CommitRevealManager(config);
    this.metricsCollector = new MetricsCollector(config);
  }

  /**
   * Start the oracle worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Oracle worker is already running');
    }

    console.log(`Starting oracle worker for node: ${this.config.nodeKeypair.publicKey}`);
    this.isRunning = true;

    // Start drift detection checks
    this.startDriftDetection();

    // Start metrics collection
    this.metricsCollector.start();

    console.log('Oracle worker started successfully');
  }

  /**
   * Stop the oracle worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping oracle worker...');
    this.isRunning = false;

    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
    }

    this.metricsCollector.stop();

    console.log('Oracle worker stopped');
  }

  /**
   * Process an inference request
   */
  async processInferenceRequest(request: ModelInferenceRequest): Promise<ModelInferenceResult> {
    if (!this.isRunning) {
      throw new Error('Oracle worker is not running');
    }

    const startTime = Date.now();

    try {
      // Check if model has drifted
      if (await this.hasModelDrifted(request.modelHash)) {
        throw new Error('Model has drifted, refusing to serve inference');
      }

      // Run inference
      const result = await this.runInference(request);

      // Sign the result
      const signedResult = this.signResult(result);

      // Execute commit-reveal process
      await this.commitRevealManager.submitCommitReveal(
        request.requestId,
        signedResult.score,
        request.modelHash
      );

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metricsCollector.recordSuccessfulSubmission(responseTime);

      return signedResult;
    } catch (error) {
      this.metricsCollector.recordFailedSubmission();
      throw error;
    }
  }

  /**
   * Run ML model inference
   */
  private async runInference(request: ModelInferenceRequest): Promise<ModelInferenceResult> {
    // This would call into the actual ML model from @chenaikit/core
    // For now, we'll return a mock result
    const score = Math.floor(Math.random() * 1000);
    
    return {
      requestId: request.requestId,
      score,
      confidence: 0.95,
      modelHash: request.modelHash,
      timestamp: Date.now(),
    };
  }

  /**
   * Sign the inference result with the node's keypair
   */
  private signResult(result: ModelInferenceResult): ModelInferenceResult {
    // In a real implementation, this would use Stellar SDK to sign
    // For now, we'll just return the result
    return result;
  }

  /**
   * Check if the model has drifted
   */
  private async hasModelDrifted(_modelHash: string): Promise<boolean> {
    // This would integrate with packages/core/src/ai/mlops/driftDetector.ts
    // For now, we'll return false
    return false;
  }

  /**
   * Start periodic drift detection checks
   */
  private startDriftDetection(): void {
    this.driftCheckInterval = setInterval(async () => {
      try {
        const approvedModels = await this.getApprovedModels();
        for (const modelHash of approvedModels) {
          if (await this.hasModelDrifted(modelHash)) {
            console.warn(`Model drift detected for: ${modelHash}`);
            // In production, this would trigger alerts and stop serving
          }
        }
      } catch (error) {
        console.error('Error during drift detection check:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get approved model versions from the oracle contract
   */
  private async getApprovedModels(): Promise<string[]> {
    // This would query the oracle contract for approved models
    // For now, return empty array
    return [];
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; details: any }> {
    const metrics = this.getMetrics();
    
    return {
      healthy: this.isRunning,
      details: {
        uptime: metrics.uptime,
        totalRequests: metrics.totalRequests,
        successRate: metrics.totalRequests > 0 
          ? (metrics.successfulSubmissions / metrics.totalRequests) * 100 
          : 0,
        averageResponseTime: metrics.averageResponseTime,
      },
    };
  }
}
