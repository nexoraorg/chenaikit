/**
 * Example usage of the AI Model base class and providers
 * Demonstrates how to extend and use the base AIModel class
 */

import { AIModel, ModelInput, ModelOutput, ModelConfig } from '../base-model';
import { OpenAIModel } from '../providers/openai-model';
import { HuggingFaceModel } from '../providers/huggingface-model';
import { CustomModel } from '../providers/custom-model';
import { OpenAIConfig, HuggingFaceConfig, CustomModelConfig } from '../types';

// Example 1: Using OpenAI Model
export async function openaiExample() {
  const config: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
    provider: 'openai',
    modelVersion: 'gpt-3.5-turbo',
    organization: 'your-org-id',
    timeout: 30000,
    rateLimit: 60,
  };

  const model = new OpenAIModel(config);

  const input: ModelInput = {
    prompt: 'Explain quantum computing in simple terms',
    maxTokens: 150,
    temperature: 0.7,
    systemMessage: 'You are a helpful science teacher.',
  };

  try {
    const result = await model.generate(input);
    console.log('OpenAI Response:', result.text);
    console.log('Tokens used:', result.tokensUsed);
    console.log('Model:', result.metadata?.model);
  } catch (error) {
    console.error('OpenAI Error:', error);
  }
}

// Example 2: Using Hugging Face Model
export async function huggingfaceExample() {
  const config: HuggingFaceConfig = {
    apiKey: process.env.HUGGINGFACE_API_KEY || 'your-hf-key',
    provider: 'huggingface',
    modelVersion: 'microsoft/DialoGPT-medium',
    useAuth: true,
    timeout: 30000,
  };

  const model = new HuggingFaceModel(config);

  const input: ModelInput = {
    prompt: 'The future of artificial intelligence is',
    maxTokens: 50,
    temperature: 0.8,
  };

  try {
    // Check if model is loaded
    const status = await model.checkModelStatus();
    if (!status.loaded) {
      console.log('Model is loading, please wait...');
      return;
    }

    const result = await model.generate(input);
    console.log('Hugging Face Response:', result.text);
  } catch (error) {
    console.error('Hugging Face Error:', error);
  }
}

// Example 3: Using Custom Model
export async function customModelExample() {
  const config: CustomModelConfig = {
    apiKey: process.env.CUSTOM_API_KEY || 'your-custom-key',
    provider: 'custom',
    modelVersion: 'my-custom-model-v1',
    customEndpoint: 'https://api.mycompany.com/v1/chat',
    timeout: 30000,
    headers: {
      'X-Custom-Header': 'value',
    },
  };

  const model = new CustomModel(config);

  const input: ModelInput = {
    prompt: 'Generate a creative story about a robot',
    maxTokens: 200,
    temperature: 0.9,
  };

  try {
    const result = await model.generate(input);
    console.log('Custom Model Response:', result.text);
  } catch (error) {
    console.error('Custom Model Error:', error);
  }
}

// Example 4: Batch Processing
export async function batchProcessingExample() {
  const config: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
    provider: 'openai',
    modelVersion: 'gpt-3.5-turbo',
  };

  const model = new OpenAIModel(config);

  const inputs: ModelInput[] = [
    { prompt: 'What is machine learning?' },
    { prompt: 'Explain neural networks' },
    { prompt: 'What is deep learning?' },
  ];

  try {
    const results = await model.generateBatch(inputs);
    
    results.forEach((result, index) => {
      console.log(`Question ${index + 1}:`, inputs[index].prompt);
      console.log(`Answer:`, result.text);
      console.log('---');
    });
  } catch (error) {
    console.error('Batch Processing Error:', error);
  }
}

// Example 5: Custom Model Implementation
class MyCustomModel extends AIModel {
  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    // Custom implementation for your specific API
    const response = await this.httpClient.post('/generate', {
      text: input.prompt,
      max_length: input.maxTokens || 100,
      temperature: input.temperature || 0.7,
    });

    return {
      text: response.data.generated_text,
      tokensUsed: response.data.tokens_used,
      metadata: {
        model: 'my-custom-model',
        finishReason: 'stop',
        provider: 'custom',
      },
      rawResponse: response.data,
    };
  }

  protected getModelName(): string {
    return 'my-custom-model';
  }

  getCapabilities() {
    return {
      textGeneration: true,
      chat: false,
      streaming: false,
      batchProcessing: true,
      maxContextLength: 1024,
      languages: ['en'],
    };
  }
}

export async function customImplementationExample() {
  const config: ModelConfig = {
    apiKey: 'your-api-key',
    baseUrl: 'https://api.yourcompany.com',
    timeout: 30000,
    rateLimit: 100,
  };

  const model = new MyCustomModel(config);

  const input: ModelInput = {
    prompt: 'Generate a product description for a smartwatch',
    maxTokens: 100,
    temperature: 0.8,
  };

  try {
    const result = await model.generate(input);
    console.log('Custom Implementation Response:', result.text);
  } catch (error) {
    console.error('Custom Implementation Error:', error);
  }
}

// Example 6: Error Handling and Retry Logic
export async function errorHandlingExample() {
  const config: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
    provider: 'openai',
    modelVersion: 'gpt-3.5-turbo',
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
    },
  };

  const model = new OpenAIModel(config);

  const input: ModelInput = {
    prompt: 'Test prompt',
    maxTokens: 10,
  };

  try {
    const result = await model.generate(input);
    console.log('Success:', result.text);
  } catch (error: any) {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      console.log('Rate limit exceeded, please wait...');
      const status = model.getRateLimitStatus();
      if (status) {
        console.log(`Try again in ${Math.ceil(status.resetTime / 1000)} seconds`);
      }
    } else if (error.retryable) {
      console.log('Retryable error occurred:', error.message);
    } else {
      console.log('Non-retryable error:', error.message);
    }
  }
}

// Example 7: Configuration Management
export async function configurationExample() {
  const model = new OpenAIModel({
    apiKey: 'initial-key',
    provider: 'openai',
    modelVersion: 'gpt-3.5-turbo',
    timeout: 30000,
  });

  console.log('Initial config:', model.getConfig());

  // Update configuration
  model.updateConfig({
    apiKey: 'new-key',
    timeout: 60000,
    rateLimit: 120,
  });

  console.log('Updated config:', model.getConfig());

  // Test connection
  const isConnected = await model.testConnection();
  console.log('Connection status:', isConnected);
}

// Example 8: Rate Limiting
export async function rateLimitingExample() {
  const model = new OpenAIModel({
    apiKey: 'your-key',
    provider: 'openai',
    modelVersion: 'gpt-3.5-turbo',
    rateLimit: 2, // Very low limit for testing
  });

  const input: ModelInput = {
    prompt: 'Test',
    maxTokens: 5,
  };

  try {
    // Make multiple requests quickly
    const promises = Array(5).fill(null).map(() => model.generate(input));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Request ${index + 1}: Success`);
      } else {
        console.log(`Request ${index + 1}: Failed - ${result.reason.message}`);
      }
    });
  } catch (error) {
    console.error('Rate limiting error:', error);
  }
}
