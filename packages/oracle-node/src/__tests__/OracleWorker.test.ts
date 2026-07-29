import { OracleWorker } from '../OracleWorker';
import { OracleConfig } from '../types';

describe('OracleWorker', () => {
  let mockConfig: OracleConfig;
  let worker: OracleWorker;

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
    worker = new OracleWorker(mockConfig);
  });

  afterEach(() => {
    if (worker.isRunning()) {
      worker.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with correct config', () => {
      expect(worker).toBeDefined();
    });

    it('should start in stopped state', () => {
      expect(worker.isRunning()).toBe(false);
    });
  });

  describe('start and stop', () => {
    it('should start successfully', async () => {
      await worker.start();
      expect(worker.isRunning()).toBe(true);
    });

    it('should stop successfully', async () => {
      await worker.start();
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await worker.start();
      await worker.start(); // Should not throw
      expect(worker.isRunning()).toBe(true);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await worker.start();
      await worker.stop();
      await worker.stop(); // Should not throw
      expect(worker.isRunning()).toBe(false);
    });
  });

  describe('inference processing', () => {
    it('should process inference request', async () => {
      await worker.start();
      
      const request = {
        requestId: 'test-request-1',
        inputData: { feature1: 0.5, feature2: 0.3 },
        modelHash: 'test-model-hash',
      };

      const result = await worker.processInference(request);
      
      expect(result).toBeDefined();
      expect(result.requestId).toBe('test-request-1');
      expect(result.value).toBeDefined();
      expect(result.signature).toBeDefined();
    });

    it('should reject requests from drifted models', async () => {
      await worker.start();
      
      const request = {
        requestId: 'test-request-2',
        inputData: { feature1: 0.5, feature2: 0.3 },
        modelHash: 'drifted-model-hash',
      };

      // Mock drift detection to return true
      const hasDriftedSpy = jest.spyOn(worker as any, 'hasModelDrifted').mockResolvedValue(true);

      await expect(worker.processInference(request)).rejects.toThrow('Model has drifted');
      
      hasDriftedSpy.mockRestore();
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics', async () => {
      await worker.start();
      
      const metrics = await worker.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.nodeId).toBe(mockConfig.nodeKeypair.publicKey);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
    });

    it('should update metrics after processing requests', async () => {
      await worker.start();
      
      const initialMetrics = await worker.getMetrics();
      
      const request = {
        requestId: 'test-request-3',
        inputData: { feature1: 0.5, feature2: 0.3 },
        modelHash: 'test-model-hash',
      };

      await worker.processInference(request);
      
      const updatedMetrics = await worker.getMetrics();
      
      expect(updatedMetrics.totalRequests).toBe(initialMetrics.totalRequests + 1);
    });
  });

  describe('error handling', () => {
    it('should handle RPC errors gracefully', async () => {
      const badConfig = {
        ...mockConfig,
        rpcUrl: 'http://invalid-rpc-url:9999',
      };
      
      const badWorker = new OracleWorker(badConfig);
      
      await expect(badWorker.start()).rejects.toThrow();
    });

    it('should handle invalid model paths', async () => {
      const badConfig = {
        ...mockConfig,
        modelPath: '/invalid/model/path.pkl',
      };
      
      const badWorker = new OracleWorker(badConfig);
      
      await expect(badWorker.start()).rejects.toThrow();
    });
  });
});
