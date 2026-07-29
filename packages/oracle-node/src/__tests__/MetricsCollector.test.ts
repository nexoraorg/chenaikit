import { MetricsCollector } from '../MetricsCollector';
import { OracleConfig, OracleMetrics } from '../types';

describe('MetricsCollector', () => {
  let mockConfig: OracleConfig;
  let collector: MetricsCollector;

  beforeEach(() => {
    mockConfig = {
      nodeKeypair: {
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
      },
      rpcUrl: 'http://localhost:8000',
      contractAddress: 'test-contract-address',
      modelPath: '/models/test.pkl',
      driftThreshold: 0.15,
    };
    collector = new MetricsCollector(mockConfig);
  });

  afterEach(() => {
    if (collector.isCollecting()) {
      collector.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with correct config', () => {
      expect(collector).toBeDefined();
    });

    it('should start with default metrics', () => {
      const metrics = collector.getMetrics();
      
      expect(metrics.nodeId).toBe(mockConfig.nodeKeypair.publicKey);
      expect(metrics.uptime).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulSubmissions).toBe(0);
      expect(metrics.failedSubmissions).toBe(0);
    });
  });

  describe('start and stop', () => {
    it('should start collecting metrics', () => {
      collector.start();
      expect(collector.isCollecting()).toBe(true);
    });

    it('should stop collecting metrics', () => {
      collector.start();
      collector.stop();
      expect(collector.isCollecting()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      collector.start();
      collector.start(); // Should not throw
      expect(collector.isCollecting()).toBe(true);
    });

    it('should handle multiple stop calls gracefully', () => {
      collector.start();
      collector.stop();
      collector.stop(); // Should not throw
      expect(collector.isCollecting()).toBe(false);
    });
  });

  describe('metrics tracking', () => {
    it('should increment total requests', () => {
      collector.incrementTotalRequests();
      const metrics = collector.getMetrics();
      
      expect(metrics.totalRequests).toBe(1);
    });

    it('should increment successful submissions', () => {
      collector.incrementSuccessfulSubmission();
      const metrics = collector.getMetrics();
      
      expect(metrics.successfulSubmissions).toBe(1);
    });

    it('should increment failed submissions', () => {
      collector.incrementFailedSubmission();
      const metrics = collector.getMetrics();
      
      expect(metrics.failedSubmissions).toBe(1);
    });

    it('should record response time', () => {
      collector.recordResponseTime(150);
      const metrics = collector.getMetrics();
      
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should calculate average response time correctly', () => {
      collector.recordResponseTime(100);
      collector.recordResponseTime(200);
      collector.recordResponseTime(300);
      
      const metrics = collector.getMetrics();
      
      expect(metrics.averageResponseTime).toBe(200);
    });

    it('should update uptime', () => {
      collector.start();
      
      // Wait a bit
      jest.advanceTimersByTime(1000);
      
      collector.updateUptime();
      const metrics = collector.getMetrics();
      
      expect(metrics.uptime).toBeGreaterThan(0);
    });

    it('should update reputation', () => {
      collector.updateReputation(1050);
      const metrics = collector.getMetrics();
      
      expect(metrics.reputation).toBe(1050);
    });
  });

  describe('periodic updates', () => {
    it('should update metrics periodically when started', (done) => {
      collector.start();
      
      setTimeout(() => {
        const metrics = collector.getMetrics();
        expect(metrics.uptime).toBeGreaterThan(0);
        collector.stop();
        done();
      }, 1100);
    });
  });

  describe('metrics export', () => {
    it('should export metrics as JSON', () => {
      collector.incrementTotalRequests();
      collector.incrementSuccessfulSubmission();
      
      const json = collector.exportMetrics();
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.nodeId).toBe(mockConfig.nodeKeypair.publicKey);
      expect(parsed.totalRequests).toBe(1);
      expect(parsed.successfulSubmissions).toBe(1);
    });

    it('should export metrics as object', () => {
      collector.incrementTotalRequests();
      collector.incrementSuccessfulSubmission();
      
      const obj = collector.getMetrics();
      
      expect(obj).toBeDefined();
      expect(obj.nodeId).toBe(mockConfig.nodeKeypair.publicKey);
      expect(obj.totalRequests).toBe(1);
      expect(obj.successfulSubmissions).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset metrics to defaults', () => {
      collector.incrementTotalRequests();
      collector.incrementSuccessfulSubmission();
      collector.incrementFailedSubmission();
      
      collector.reset();
      const metrics = collector.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulSubmissions).toBe(0);
      expect(metrics.failedSubmissions).toBe(0);
    });
  });

  describe('health check', () => {
    it('should return healthy status when collecting', () => {
      collector.start();
      
      const health = collector.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.isCollecting).toBe(true);
    });

    it('should return unhealthy status when not collecting', () => {
      const health = collector.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.isCollecting).toBe(false);
    });

    it('should include error rate in health status', () => {
      collector.incrementTotalRequests();
      collector.incrementFailedSubmission();
      
      const health = collector.getHealthStatus();
      
      expect(health.errorRate).toBe(1.0);
    });
  });
});
