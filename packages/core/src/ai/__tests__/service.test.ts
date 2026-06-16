import { AIService } from '../service';
import { AIConfig } from '../types';

describe('AIService', () => {
  let aiService: AIService;
  let mockConfig: AIConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      modelUrl: 'https://api.example.com',
      timeout: 5000
    };
    aiService = new AIService(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(aiService).toBeInstanceOf(AIService);
    });

    it('should work with minimal config', () => {
      const minimalConfig: AIConfig = { apiKey: 'test-key' };
      const minimalService = new AIService(minimalConfig);
      expect(minimalService).toBeInstanceOf(AIService);
    });
  });

  describe('calculateCreditScore', () => {
    it('should throw error as not implemented', async () => {
      const accountData = { accountId: 'G123', balance: '1000' };
      await expect(aiService.calculateCreditScore(accountData))
        .rejects.toThrow('Not implemented yet - see issue #25');
    });
  });

  describe('detectFraud', () => {
    it('should throw error as not implemented', async () => {
      const transactionData = { from: 'G123', to: 'G456', amount: '100' };
      await expect(aiService.detectFraud(transactionData))
        .rejects.toThrow('Not implemented yet - see issue #28');
    });
  });
});
