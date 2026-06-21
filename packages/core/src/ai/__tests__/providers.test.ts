import { OpenAIModel } from '../providers/openai-model';
import { HuggingFaceModel } from '../providers/huggingface-model';
import { CustomModel } from '../providers/custom-model';
import { OpenAIConfig, HuggingFaceConfig, CustomModelConfig } from '../types';
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
  post: jest.fn(),
  get: jest.fn(),
} as any);

describe('AI Model Providers', () => {
  describe('OpenAIModel', () => {
    let model: OpenAIModel;
    let config: OpenAIConfig;

    beforeEach(() => {
      config = {
        apiKey: 'test-openai-key',
        provider: 'openai',
        modelVersion: 'gpt-3.5-turbo',
        organization: 'test-org',
      };
      model = new OpenAIModel(config);
      jest.clearAllMocks();
    });

    it('should initialize with correct configuration', () => {
      expect(model.getConfig().baseUrl).toBe('https://api.openai.com/v1');
      expect(model.getConfig().apiKey).toBe('test-openai-key');
    });

    it('should build correct request body for chat completion', async () => {
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 10 },
          model: 'gpt-3.5-turbo',
        },
      };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const input = {
        prompt: 'Hello, world!',
        maxTokens: 100,
        temperature: 0.7,
      };

      await model.generate(input);

      // Verify the request was made with correct parameters
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('should handle system messages', async () => {
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 10 },
          model: 'gpt-3.5-turbo',
        },
      };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const input = {
        prompt: 'Hello, world!',
        systemMessage: 'You are a helpful assistant.',
      };

      await model.generate(input);
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('should return correct capabilities', () => {
      const capabilities = model.getCapabilities();
      
      expect(capabilities.textGeneration).toBe(true);
      expect(capabilities.chat).toBe(true);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.batchProcessing).toBe(true);
      expect(capabilities.maxContextLength).toBe(4096);
      expect(capabilities.languages).toContain('en');
    });

    it('should get correct max context length for different models', () => {
      const gpt4Config: OpenAIConfig = {
        ...config,
        modelVersion: 'gpt-4',
      };
      const gpt4Model = new OpenAIModel(gpt4Config);
      
      const capabilities = gpt4Model.getCapabilities();
      expect(capabilities.maxContextLength).toBe(8192);
    });
  });

  describe('HuggingFaceModel', () => {
    let model: HuggingFaceModel;
    let config: HuggingFaceConfig;

    beforeEach(() => {
      config = {
        apiKey: 'test-hf-key',
        provider: 'huggingface',
        modelVersion: 'microsoft/DialoGPT-medium',
        useAuth: true,
      };
      model = new HuggingFaceModel(config);
      jest.clearAllMocks();
    });

    it('should initialize with correct configuration', () => {
      expect(model.getConfig().baseUrl).toBe('https://api-inference.huggingface.co/models');
      expect(model.getConfig().apiKey).toBe('test-hf-key');
    });

    it('should return correct capabilities', () => {
      const capabilities = model.getCapabilities();
      
      expect(capabilities.textGeneration).toBe(true);
      expect(capabilities.chat).toBe(false);
      expect(capabilities.streaming).toBe(false);
      expect(capabilities.batchProcessing).toBe(true);
      expect(capabilities.maxContextLength).toBe(1024);
    });

    it('should check model status', async () => {
      const mockResponse = { data: { status: 'loaded' } };
      
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const status = await model.checkModelStatus();
      expect(status.loaded).toBe(true);
      expect(status.loading).toBe(false);
    });

    it('should handle model loading status', async () => {
      const mockError = {
        response: { status: 503 },
      };
      
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const status = await model.checkModelStatus();
      expect(status.loaded).toBe(false);
      expect(status.loading).toBe(true);
    });
  });

  describe('CustomModel', () => {
    let model: CustomModel;
    let config: CustomModelConfig;

    beforeEach(() => {
      config = {
        apiKey: 'test-custom-key',
        provider: 'custom',
        modelVersion: 'custom-model-v1',
        customEndpoint: 'https://api.custom.com/v1',
      };
      model = new CustomModel(config);
      jest.clearAllMocks();
    });

    it('should initialize with custom endpoint', () => {
      expect(model.getConfig().baseUrl).toBe('https://api.custom.com/v1');
      expect(model.getConfig().apiKey).toBe('test-custom-key');
    });

    it('should return default capabilities', () => {
      const capabilities = model.getCapabilities();
      
      expect(capabilities.textGeneration).toBe(true);
      expect(capabilities.chat).toBe(false);
      expect(capabilities.streaming).toBe(false);
      expect(capabilities.batchProcessing).toBe(true);
      expect(capabilities.maxContextLength).toBe(2048);
    });

    it('should handle various response formats', async () => {
      const mockResponse = {
        data: { text: 'Custom response' },
      };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const input = { prompt: 'test' };
      const result = await model.generate(input);
      
      expect(result.text).toBe('Custom response');
      expect(result.metadata?.provider).toBe('custom');
    });

    it('should handle string responses', async () => {
      const mockResponse = {
        data: 'Simple string response',
      };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const input = { prompt: 'test' };
      const result = await model.generate(input);
      
      expect(result.text).toBe('Simple string response');
    });

    it('should handle array responses', async () => {
      const mockResponse = {
        data: [{ generated_text: 'Generated text' }],
      };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        defaults: {},
      } as any);

      const input = { prompt: 'test' };
      const result = await model.generate(input);
      
      expect(result.text).toBe('Generated text');
    });
  });
});
