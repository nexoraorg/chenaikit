import { AIModel, ModelConfig, ModelInput, ModelOutput, AIModelError } from '../base-model';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.create to return a mock instance
mockedAxios.create.mockReturnValue({
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  defaults: {},
} as any);

// Test implementation of AIModel
class TestAIModel extends AIModel {
  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    return {
      text: 'Test response',
      tokensUsed: 10,
      metadata: {
        model: 'test-model',
        finishReason: 'stop',
      },
    };
  }

  protected getModelName(): string {
    return 'test-model';
  }
}

describe('AIModel Base Class', () => {
  let model: TestAIModel;
  let config: ModelConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      timeout: 30000,
      rateLimit: 60,
    };
    model = new TestAIModel(config);
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultConfig: ModelConfig = {
        apiKey: 'test-key',
      };
      const testModel = new TestAIModel(defaultConfig);
      
      expect(testModel.getConfig()).toEqual({
        apiKey: 'test-key',
        timeout: 30000,
        rateLimit: 60,
      });
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig: ModelConfig = {
        apiKey: 'custom-key',
        timeout: 60000,
        rateLimit: 120,
        headers: { 'Custom-Header': 'value' },
      };
      const testModel = new TestAIModel(customConfig);
      
      expect(testModel.getConfig()).toEqual({
        apiKey: 'custom-key',
        timeout: 60000,
        rateLimit: 120,
        headers: { 'Custom-Header': 'value' },
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate required prompt', async () => {
      const invalidInput = { prompt: '' } as ModelInput;
      
      await expect(model.generate(invalidInput)).rejects.toThrow(AIModelError);
      await expect(model.generate(invalidInput)).rejects.toThrow('Prompt is required and must be a string');
    });

    it('should validate maxTokens range', async () => {
      const invalidInput: ModelInput = {
        prompt: 'test',
        maxTokens: 5000,
      };
      
      await expect(model.generate(invalidInput)).rejects.toThrow(AIModelError);
      await expect(model.generate(invalidInput)).rejects.toThrow('maxTokens must be between 1 and 4000');
    });

    it('should validate temperature range', async () => {
      const invalidInput: ModelInput = {
        prompt: 'test',
        temperature: 3,
      };
      
      await expect(model.generate(invalidInput)).rejects.toThrow(AIModelError);
      await expect(model.generate(invalidInput)).rejects.toThrow('temperature must be between 0 and 2');
    });

    it('should validate topP range', async () => {
      const invalidInput: ModelInput = {
        prompt: 'test',
        topP: 2,
      };
      
      await expect(model.generate(invalidInput)).rejects.toThrow(AIModelError);
      await expect(model.generate(invalidInput)).rejects.toThrow('topP must be between 0 and 1');
    });

    it('should accept valid input', async () => {
      const validInput: ModelInput = {
        prompt: 'test prompt',
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
      };
      
      const result = await model.generate(validInput);
      expect(result.text).toBe('Test response');
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const status = model.getRateLimitStatus();
      expect(status).toEqual({
        current: 0,
        max: 60,
        resetTime: 60000,
      });
    });

    it('should return null when rate limiting is disabled', () => {
      const noLimitConfig: ModelConfig = {
        apiKey: 'test-key',
        rateLimit: undefined,
      };
      const testModel = new TestAIModel(noLimitConfig);
      
      expect(testModel.getRateLimitStatus()).toBeNull();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple inputs', async () => {
      const inputs: ModelInput[] = [
        { prompt: 'first prompt' },
        { prompt: 'second prompt' },
        { prompt: 'third prompt' },
      ];
      
      const results = await model.generateBatch(inputs);
      
      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('Test response');
      expect(results[1].text).toBe('Test response');
      expect(results[2].text).toBe('Test response');
    });

    it('should handle errors in batch processing', async () => {
      // Mock the makeRequest method to throw an error for the second input
      const originalMakeRequest = model['makeRequest'];
      let callCount = 0;
      model['makeRequest'] = jest.fn().mockImplementation(async (input: ModelInput) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Test error');
        }
        return originalMakeRequest.call(model, input);
      });

      const inputs: ModelInput[] = [
        { prompt: 'first prompt' },
        { prompt: 'second prompt' },
        { prompt: 'third prompt' },
      ];
      
      const results = await model.generateBatch(inputs);
      
      expect(results).toHaveLength(3);
      expect(results[0].text).toBe('Test response');
      expect(results[1].text).toBe('');
      expect(results[1].metadata?.finishReason).toBe('error');
      expect(results[2].text).toBe('Test response');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        timeout: 60000,
        rateLimit: 120,
      };
      
      model.updateConfig(newConfig);
      
      const updatedConfig = model.getConfig();
      expect(updatedConfig.timeout).toBe(60000);
      expect(updatedConfig.rateLimit).toBe(120);
      expect(updatedConfig.apiKey).toBe('test-api-key'); // Should preserve existing values
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const isConnected = await model.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should handle connection test failures', async () => {
      // Mock makeRequest to throw an error
      model['makeRequest'] = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      const isConnected = await model.testConnection();
      expect(isConnected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENOTFOUND';
      
      model['makeRequest'] = jest.fn().mockRejectedValue(networkError);
      
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow(AIModelError);
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow('Network connection failed');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      
      model['makeRequest'] = jest.fn().mockRejectedValue(timeoutError);
      
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow(AIModelError);
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow('Request timeout');
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      
      model['makeRequest'] = jest.fn().mockRejectedValue(unknownError);
      
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow(AIModelError);
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow('Unknown error');
    });
  });

  describe('Output Validation', () => {
    it('should validate output format', async () => {
      model['makeRequest'] = jest.fn().mockResolvedValue({
        text: '', // Invalid empty text
      });
      
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow(AIModelError);
      await expect(model.generate({ prompt: 'test' })).rejects.toThrow('Invalid output format: text is required');
    });
  });
});
