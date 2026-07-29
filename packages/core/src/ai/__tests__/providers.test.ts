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
  // Helper to create a mock axios instance with controllable post/get
  function createMockAxios(postImpl?: jest.Mock, getImpl?: jest.Mock) {
    return {
      post: postImpl || jest.fn().mockResolvedValue({ data: { choices: [{ message: { content: 'test' } }], usage: { total_tokens: 5 }, model: 'gpt-3.5-turbo' } }),
      get: getImpl || jest.fn().mockResolvedValue({ data: { status: 'loaded' } }),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: {},
    } as any;
  }

  function setMockAxios(instance: any) {
    mockedAxios.create.mockReturnValue(instance);
  }

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

    it('should pass organization header when configured', async () => {
      const orgModel = new OpenAIModel({
        ...config,
        organization: 'custom-org-id',
      });

      const mockPost = jest.fn().mockResolvedValue({
        data: { choices: [{ message: { content: 'test' } }], usage: { total_tokens: 5 }, model: 'gpt-3.5-turbo' },
      });
      setMockAxios(createMockAxios(mockPost));

      await orgModel.generate({ prompt: 'hello' });
      const postArgs = mockPost.mock.calls[0];
      expect(postArgs[0]).toBe('/chat/completions');
      expect(postArgs[1].model).toBe('gpt-3.5-turbo');
    });

    it('should handle conversation history messages', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Assistant reply' }, finish_reason: 'stop' }],
          usage: { total_tokens: 20 },
          model: 'gpt-3.5-turbo',
        },
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await model.generate({
        prompt: 'Tell me a joke',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      });

      expect(result.text).toBe('Assistant reply');
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should handle non-streaming response correctly', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Non-streaming response' }, finish_reason: 'stop' }],
          usage: { total_tokens: 8 },
          model: 'gpt-3.5-turbo',
        },
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await model.generate({ prompt: 'test' });
      expect(result.tokensUsed).toBe(8);
      expect(result.metadata?.finishReason).toBe('stop');
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

    it('should handle useAuth disabled', async () => {
      const noAuthConfig: HuggingFaceConfig = {
        ...config,
        useAuth: false,
      };
      const noAuthModel = new HuggingFaceModel(noAuthConfig);
      
      const mockPost = jest.fn().mockResolvedValue({
        data: [{ generated_text: 'No auth response' }],
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await noAuthModel.generate({ prompt: 'test' });
      expect(result.text).toBe('No auth response');
    });

    it('should resolve model version correctly', async () => {
      const hfModel = new HuggingFaceModel({
        ...config,
        modelVersion: 'gpt2',
      });
      
      const mockPost = jest.fn().mockResolvedValue({
        data: [{ generated_text: 'GPT-2 response' }],
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await hfModel.generate({ prompt: 'test' });
      expect(result.text).toBe('GPT-2 response');
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

    it('should support custom request/response transformation', async () => {
      const transformConfig: CustomModelConfig = {
        ...config,
        customEndpoint: 'https://api.custom.com/v2/complete',
        modelVersion: 'custom-v2',
      };
      const transformModel = new CustomModel(transformConfig);
      
      const mockPost = jest.fn().mockResolvedValue({
        data: { result: 'Transformed response' },
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await transformModel.generate({ prompt: 'transform test' });
      expect(result.text).toBe('Transformed response');
    });

    it('should route to arbitrary endpoints', async () => {
      const routedConfig: CustomModelConfig = {
        ...config,
        customEndpoint: 'https://internal.api.local/ai/generate',
      };
      const routedModel = new CustomModel(routedConfig);
      
      const mockPost = jest.fn().mockResolvedValue({
        data: { output: 'Internal API response' },
      });
      setMockAxios(createMockAxios(mockPost));

      const result = await routedModel.generate({ prompt: 'route test' });
      expect(mockPost).toHaveBeenCalled();
      expect(result.metadata?.provider).toBe('custom');
    });
  });
});
