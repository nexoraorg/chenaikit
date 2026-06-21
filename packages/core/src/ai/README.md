# AI Model Base Class

This module provides a comprehensive base class for AI model integrations that can be extended for different ML services (OpenAI, Hugging Face, custom models).

## Features

- **Abstract Base Class**: `AIModel` provides common functionality for all AI providers
- **Provider Implementations**: Ready-to-use implementations for OpenAI, Hugging Face, and custom models
- **Configuration Management**: Flexible configuration system supporting multiple API keys and model types
- **Error Handling**: Comprehensive error handling for network and API errors
- **Rate Limiting**: Built-in rate limiting with configurable limits
- **Batch Processing**: Support for processing multiple requests
- **TypeScript Support**: Full TypeScript interfaces and type safety
- **Testing**: Comprehensive unit tests for all functionality

## Quick Start

### Basic Usage

```typescript
import { OpenAIModel } from './providers/openai-model';
import { ModelInput } from './types';

const model = new OpenAIModel({
  apiKey: 'your-openai-key',
  provider: 'openai',
  modelVersion: 'gpt-3.5-turbo',
});

const input: ModelInput = {
  prompt: 'Hello, world!',
  maxTokens: 100,
  temperature: 0.7,
};

const result = await model.generate(input);
console.log(result.text);
```

### Using Different Providers

#### OpenAI
```typescript
import { OpenAIModel } from './providers/openai-model';

const model = new OpenAIModel({
  apiKey: 'your-openai-key',
  provider: 'openai',
  modelVersion: 'gpt-4',
  organization: 'your-org-id',
});
```

#### Hugging Face
```typescript
import { HuggingFaceModel } from './providers/huggingface-model';

const model = new HuggingFaceModel({
  apiKey: 'your-hf-key',
  provider: 'huggingface',
  modelVersion: 'microsoft/DialoGPT-medium',
  useAuth: true,
});
```

#### Custom Model
```typescript
import { CustomModel } from './providers/custom-model';

const model = new CustomModel({
  apiKey: 'your-custom-key',
  provider: 'custom',
  modelVersion: 'my-model-v1',
  customEndpoint: 'https://api.mycompany.com/v1',
});
```

## Architecture

### Base Class (`AIModel`)

The `AIModel` abstract class provides:

- **Configuration Management**: API keys, timeouts, rate limits
- **Request/Response Formatting**: Standardized input/output interfaces
- **Error Handling**: Network errors, API errors, validation errors
- **Rate Limiting**: Configurable request throttling
- **Batch Processing**: Multiple request handling
- **Connection Testing**: Health checks for API endpoints

### Provider Implementations

#### OpenAI Model (`OpenAIModel`)
- Supports chat completions API
- Handles system messages and conversation history
- Configurable model versions (GPT-3.5, GPT-4, etc.)
- Organization support

#### Hugging Face Model (`HuggingFaceModel`)
- Inference API integration
- Model status checking
- Support for various model types
- Authentication handling

#### Custom Model (`CustomModel`)
- Generic implementation for custom APIs
- Flexible request/response parsing
- Configurable endpoints
- Extensible for specific needs

## Configuration

### Model Configuration

```typescript
interface ModelConfig {
  apiKey: string;                    // Required API key
  baseUrl?: string;                 // API base URL
  timeout?: number;                 // Request timeout (ms)
  rateLimit?: number;               // Requests per minute
  headers?: Record<string, string>; // Additional headers
  modelOptions?: Record<string, any>; // Model-specific options
}
```

### Provider-Specific Configuration

#### OpenAI
```typescript
interface OpenAIConfig extends ModelConfig {
  provider: 'openai';
  modelVersion: string;
  organization?: string;
}
```

#### Hugging Face
```typescript
interface HuggingFaceConfig extends ModelConfig {
  provider: 'huggingface';
  modelVersion: string;
  useAuth?: boolean;
}
```

#### Custom Model
```typescript
interface CustomModelConfig extends ModelConfig {
  provider: 'custom';
  modelVersion: string;
  customEndpoint: string;
}
```

## Input/Output Interfaces

### Model Input
```typescript
interface ModelInput {
  prompt: string;                    // Required input text
  maxTokens?: number;               // Max tokens to generate
  temperature?: number;             // Response randomness (0-1)
  topP?: number;                    // Top-p sampling (0-1)
  stopSequences?: string[];         // Stop generation sequences
  parameters?: Record<string, any>; // Additional parameters
  systemMessage?: string;           // System message for chat models
  messages?: Array<{                // Conversation history
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}
```

### Model Output
```typescript
interface ModelOutput {
  text: string;                     // Generated text
  tokensUsed?: number;              // Tokens consumed
  metadata?: {                      // Response metadata
    model: string;
    finishReason?: string;
    responseTime?: number;
    provider?: string;
  };
  rawResponse?: any;                // Raw API response
  chunks?: string[];               // Streaming chunks
}
```

## Error Handling

The base class provides comprehensive error handling:

```typescript
class AIModelError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  );
}
```

### Error Types
- `INVALID_INPUT`: Input validation errors
- `INVALID_OUTPUT`: Output validation errors
- `RATE_LIMIT_EXCEEDED`: Rate limiting errors
- `NETWORK_ERROR`: Network connection errors
- `TIMEOUT`: Request timeout errors
- `API_ERROR`: API-specific errors
- `SERVER_ERROR`: Server-side errors

## Rate Limiting

Built-in rate limiting with configurable limits:

```typescript
// Configure rate limiting
const model = new OpenAIModel({
  apiKey: 'your-key',
  rateLimit: 60, // 60 requests per minute
});

// Check rate limit status
const status = model.getRateLimitStatus();
console.log(`Current: ${status.current}/${status.max}`);
console.log(`Reset in: ${status.resetTime}ms`);
```

## Batch Processing

Process multiple requests efficiently:

```typescript
const inputs: ModelInput[] = [
  { prompt: 'First question' },
  { prompt: 'Second question' },
  { prompt: 'Third question' },
];

const results = await model.generateBatch(inputs);
results.forEach((result, index) => {
  console.log(`Response ${index + 1}:`, result.text);
});
```

## Creating Custom Models

Extend the base class for custom implementations:

```typescript
class MyCustomModel extends AIModel {
  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    // Implement your custom API logic
    const response = await this.httpClient.post('/your-endpoint', {
      text: input.prompt,
      max_length: input.maxTokens,
    });

    return {
      text: response.data.generated_text,
      tokensUsed: response.data.tokens_used,
      metadata: {
        model: 'my-custom-model',
        finishReason: 'stop',
        provider: 'custom',
      },
    };
  }

  protected getModelName(): string {
    return 'my-custom-model';
  }
}
```

## Testing

Comprehensive unit tests are provided:

```bash
# Run tests
npm test

# Run specific test files
npm test base-model.test.ts
npm test providers.test.ts
```

## Examples

See `examples/model-usage.ts` for comprehensive usage examples including:

- Basic model usage
- Provider-specific configurations
- Batch processing
- Error handling
- Rate limiting
- Custom implementations
- Configuration management

## API Reference

### AIModel Methods

- `generate(input: ModelInput): Promise<ModelOutput>` - Generate text
- `generateBatch(inputs: ModelInput[]): Promise<ModelOutput[]>` - Batch processing
- `getConfig(): ModelConfig` - Get current configuration
- `updateConfig(config: Partial<ModelConfig>): void` - Update configuration
- `testConnection(): Promise<boolean>` - Test API connection
- `getRateLimitStatus(): RateLimitStatus | null` - Get rate limit status

### Abstract Methods (to implement)

- `makeRequest(input: ModelInput): Promise<ModelOutput>` - Make API request
- `getModelName(): string` - Get model name

## Contributing

When adding new providers or extending functionality:

1. Extend the `AIModel` base class
2. Implement required abstract methods
3. Add provider-specific configuration interfaces
4. Include comprehensive tests
5. Update documentation
6. Add usage examples

## License

MIT License - see LICENSE file for details.
