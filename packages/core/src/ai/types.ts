export interface AIConfig {
  apiKey: string;
  modelUrl?: string;
  timeout?: number;
}

/**
 * Base configuration for AI model providers
 */
export interface ModelConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API endpoint */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of requests per minute */
  rateLimit?: number;
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
  /** Model-specific configuration */
  modelOptions?: Record<string, any>;
}

export interface CreditScoreResult {
  score: number;
  factors: string[];
  confidence: number;
}

export interface FraudDetectionResult {
  isFraud: boolean;
  riskScore: number;
  factors: string[];
}

/**
 * Extended configuration for AI model providers
 * Extends the base ModelConfig from base-model.ts
 */
export interface ExtendedModelConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API endpoint */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of requests per minute */
  rateLimit?: number;
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
  /** Model-specific configuration */
  modelOptions?: Record<string, any>;
  /** Provider-specific settings */
  provider?: 'openai' | 'huggingface' | 'custom';
  /** Model version or identifier */
  modelVersion?: string;
  /** Enable/disable streaming responses */
  streaming?: boolean;
  /** Retry configuration */
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
}

/**
 * Standard input format for AI model requests
 * Provides a consistent interface across different providers
 */
export interface ModelInput {
  /** The input prompt or text */
  prompt: string;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Stop sequences to end generation */
  stopSequences?: string[];
  /** Additional model-specific parameters */
  parameters?: Record<string, any>;
  /** System message for conversational models */
  systemMessage?: string;
  /** Conversation history for chat models */
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Standard output format for AI model responses
 * Ensures consistent response structure across providers
 */
export interface ModelOutput {
  /** The generated text response */
  text: string;
  /** Number of tokens used in the request */
  tokensUsed?: number;
  /** Model metadata */
  metadata?: {
    model: string;
    finishReason?: string;
    responseTime?: number;
    provider?: string;
  };
  /** Raw response from the API */
  rawResponse?: any;
  /** Streaming response chunks (if applicable) */
  chunks?: string[];
}

/**
 * Error types for AI model operations
 * Provides structured error handling
 */
export class AIModelError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIModelError';
  }
}

/**
 * Rate limiting configuration
 * Manages request throttling
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  currentRequests: number;
  windowStart: number;
}

/**
 * Provider-specific configuration interfaces
 */
export interface OpenAIConfig extends ExtendedModelConfig {
  provider: 'openai';
  modelVersion: string;
  organization?: string;
}

export interface HuggingFaceConfig extends ExtendedModelConfig {
  provider: 'huggingface';
  modelVersion: string;
  useAuth?: boolean;
}

export interface CustomModelConfig extends ExtendedModelConfig {
  provider: 'custom';
  modelVersion: string;
  customEndpoint: string;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Maximum number of concurrent requests */
  concurrency?: number;
  /** Delay between batch requests */
  batchDelay?: number;
  /** Retry failed requests */
  retryFailed?: boolean;
}

/**
 * Model capabilities interface
 */
export interface ModelCapabilities {
  /** Supports text generation */
  textGeneration: boolean;
  /** Supports chat/conversation */
  chat: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports batch processing */
  batchProcessing: boolean;
  /** Maximum context length */
  maxContextLength?: number;
  /** Supported languages */
  languages?: string[];
}
