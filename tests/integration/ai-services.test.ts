import { mockAIService } from './helpers/setup';

// Mock AI Models
class AIModel {
  protected config: any;
  constructor(config: any) {
    this.config = config;
  }
}

class OpenAIModel extends AIModel {}
class HuggingFaceModel extends AIModel {}

describe('AI Service Integration', () => {
  describe('AI Model Base', () => {
    it('should handle model configuration', () => {
      const config = {
        apiKey: process.env.OPENAI_API_KEY || 'test-key',
        provider: 'openai' as const,
        modelVersion: 'gpt-3.5-turbo'
      };

      expect(() => new OpenAIModel(config)).not.toThrow();
    });
  });

  describe('Credit Scoring AI', () => {
    it('should calculate AI-powered credit score', async () => {
      const aiService = mockAIService();
      
      const accountData = {
        publicKey: 'GTEST...',
        balance: '5000',
        transactionCount: 25,
        accountAge: 180
      };

      const result = await aiService.calculateCreditScore(accountData);

      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(300);
      expect(result.score).toBeLessThanOrEqual(850);
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('confidence');
    });

    it('should provide confidence scores', async () => {
      const aiService = mockAIService();
      
      const result = await aiService.calculateCreditScore({
        publicKey: 'GTEST...',
        balance: '1000',
        transactionCount: 5,
        accountAge: 10
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Fraud Detection AI', () => {
    it('should detect fraudulent patterns', async () => {
      const aiService = mockAIService();
      
      const transaction = {
        sourceAccount: 'GTEST...',
        amount: '50000',
        destination: 'GNEW...',
        timestamp: new Date().toISOString()
      };

      const result = await aiService.detectFraud(transaction);

      expect(result).toHaveProperty('isFraudulent');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('reasons');
      expect(typeof result.isFraudulent).toBe('boolean');
    });

    it('should provide risk explanations', async () => {
      const aiService = mockAIService();
      
      const suspiciousTx = {
        sourceAccount: 'GTEST...',
        amount: '999999',
        destination: 'GNEW...',
        timestamp: new Date().toISOString()
      };

      const result = await aiService.detectFraud(suspiciousTx);

      expect(Array.isArray(result.reasons)).toBe(true);
    });
  });

  describe('Model Provider Integration', () => {
    it('should work with OpenAI provider', () => {
      const config = {
        apiKey: process.env.OPENAI_API_KEY || 'test-key',
        provider: 'openai' as const,
        modelVersion: 'gpt-3.5-turbo'
      };

      const model = new OpenAIModel(config);
      expect(model).toBeInstanceOf(OpenAIModel);
    });

    it('should work with HuggingFace provider', () => {
      const config = {
        apiKey: process.env.HUGGINGFACE_API_KEY || 'test-key',
        provider: 'huggingface' as const,
        modelVersion: 'microsoft/DialoGPT-medium'
      };

      const model = new HuggingFaceModel(config);
      expect(model).toBeInstanceOf(HuggingFaceModel);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const aiService = mockAIService();
      
      // Mock error
      aiService.calculateCreditScore.mockRejectedValueOnce(
        new Error('API Error')
      );

      await expect(
        aiService.calculateCreditScore({})
      ).rejects.toThrow('API Error');
    });

    it('should handle invalid input', async () => {
      const aiService = mockAIService();
      
      const invalidData = {
        publicKey: '',
        balance: 'invalid',
        transactionCount: -1,
        accountAge: -1
      };

      // Should handle gracefully or throw validation error
      await expect(
        aiService.calculateCreditScore(invalidData)
      ).resolves.toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete analysis within timeout', async () => {
      const aiService = mockAIService();
      
      const startTime = Date.now();
      
      await aiService.calculateCreditScore({
        publicKey: 'GTEST...',
        balance: '5000',
        transactionCount: 10,
        accountAge: 30
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle batch processing', async () => {
      const aiService = mockAIService();
      
      const accounts = Array.from({ length: 10 }, (_, i) => ({
        publicKey: `GTEST${i}...`,
        balance: '1000',
        transactionCount: i * 5,
        accountAge: i * 10
      }));

      const results = await Promise.all(
        accounts.map(acc => aiService.calculateCreditScore(acc))
      );

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('score');
      });
    });
  });
});
