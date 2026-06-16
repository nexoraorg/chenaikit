import { 
  AIConfig, 
  ModelConfig, 
  CreditScoreResult, 
  FraudDetectionResult,
  AIModelError,
  ModelInput,
  ModelOutput
} from '../types';

describe('AI Types', () => {
  describe('AIConfig', () => {
    it('should create basic AI config', () => {
      const config: AIConfig = {
        apiKey: 'test-api-key',
        modelUrl: 'https://api.example.com',
        timeout: 5000
      };

      expect(config.apiKey).toBe('test-api-key');
      expect(config.modelUrl).toBe('https://api.example.com');
      expect(config.timeout).toBe(5000);
    });

    it('should work with minimal config', () => {
      const minimalConfig: AIConfig = { apiKey: 'test-key' };
      expect(minimalConfig.apiKey).toBe('test-key');
      expect(minimalConfig.modelUrl).toBeUndefined();
    });
  });

  describe('ModelConfig', () => {
    it('should create comprehensive model config', () => {
      const config: ModelConfig = {
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        timeout: 10000,
        rateLimit: 100,
        headers: { 'Content-Type': 'application/json' },
        modelOptions: { temperature: 0.7 }
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.timeout).toBe(10000);
      expect(config.rateLimit).toBe(100);
      expect(config.headers).toEqual({ 'Content-Type': 'application/json' });
    });
  });

  describe('CreditScoreResult', () => {
    it('should create credit score result', () => {
      const result: CreditScoreResult = {
        score: 750,
        factors: ['Payment History', 'Credit Utilization'],
        confidence: 0.95
      };

      expect(result.score).toBe(750);
      expect(result.factors).toContain('Payment History');
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('FraudDetectionResult', () => {
    it('should create fraud detection result', () => {
      const result: FraudDetectionResult = {
        isFraud: false,
        riskScore: 0.15,
        factors: ['Normal Transaction Pattern']
      };

      expect(result.isFraud).toBe(false);
      expect(result.riskScore).toBe(0.15);
      expect(result.factors).toHaveLength(1);
    });
  });

  describe('AIModelError', () => {
    it('should create AI model error', () => {
      const error = new AIModelError(
        'API request failed',
        'API_ERROR',
        500,
        true
      );

      expect(error.message).toBe('API request failed');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('AIModelError');
    });

    it('should create error with minimal parameters', () => {
      const error = new AIModelError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBeUndefined();
      expect(error.retryable).toBe(false);
    });
  });

  describe('ModelInput', () => {
    it('should create comprehensive model input', () => {
      const input: ModelInput = {
        prompt: 'Analyze this transaction for fraud',
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ['END'],
        parameters: { frequency_penalty: 0.1 },
        systemMessage: 'You are a fraud detection AI',
        messages: [
          { role: 'user', content: 'Is this transaction suspicious?' },
          { role: 'assistant', content: 'Let me analyze it.' }
        ]
      };

      expect(input.prompt).toBe('Analyze this transaction for fraud');
      expect(input.maxTokens).toBe(1000);
      expect(input.temperature).toBe(0.7);
      expect(input.messages).toHaveLength(2);
    });

    it('should create minimal model input', () => {
      const minimalInput: ModelInput = {
        prompt: 'Test prompt'
      };

      expect(minimalInput.prompt).toBe('Test prompt');
      expect(minimalInput.maxTokens).toBeUndefined();
    });
  });

  describe('ModelOutput', () => {
    it('should create comprehensive model output', () => {
      const output: ModelOutput = {
        text: 'This transaction appears to be legitimate.',
        tokensUsed: 150,
        metadata: {
          model: 'fraud-detection-v1',
          finishReason: 'stop',
          responseTime: 2500,
          provider: 'openai'
        },
        rawResponse: { id: 'resp-123' },
        chunks: ['This transaction', ' appears to be', ' legitimate.']
      };

      expect(output.text).toBe('This transaction appears to be legitimate.');
      expect(output.tokensUsed).toBe(150);
      expect(output.metadata?.model).toBe('fraud-detection-v1');
      expect(output.chunks).toHaveLength(3);
    });

    it('should create minimal model output', () => {
      const minimalOutput: ModelOutput = {
        text: 'Response text'
      };

      expect(minimalOutput.text).toBe('Response text');
      expect(minimalOutput.tokensUsed).toBeUndefined();
    });
  });
});
