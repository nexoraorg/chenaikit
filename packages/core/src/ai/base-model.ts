import axios, { AxiosInstance } from 'axios';

/**
 * Configuration options for AI model providers
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

/**
 * Standard input format for AI model requests
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
}

/**
 * Error types for AI model operations
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
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  currentRequests: number;
  windowStart: number;
}

/**
 * Abstract base class for AI model integrations
 * Provides common functionality for different ML services
 */
export abstract class AIModel {
  protected config: ModelConfig;
  protected httpClient: AxiosInstance;
  protected rateLimitConfig: RateLimitConfig | null = null;

  constructor(config: ModelConfig) {
    this.config = {
      timeout: 30000,
      rateLimit: 60,
      ...config,
    };

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
    });

    // Setup rate limiting if configured
    if (this.config.rateLimit) {
      this.rateLimitConfig = {
        maxRequests: this.config.rateLimit,
        windowMs: 60000, // 1 minute
        currentRequests: 0,
        windowStart: Date.now(),
      };
    }

    // Setup request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Abstract method to be implemented by concrete model classes
   * Handles the actual API call to the specific model provider
   */
  protected abstract makeRequest(input: ModelInput): Promise<ModelOutput>;

  /**
   * Public method to generate text using the model
   */
  async generate(input: ModelInput): Promise<ModelOutput> {
    try {
      // Validate input
      this.validateInput(input);

      // Check rate limits
      await this.checkRateLimit();

      // Make the request
      const result = await this.makeRequest(input);

      // Validate output
      this.validateOutput(result);

      return result;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Batch processing for multiple inputs
   */
  async generateBatch(inputs: ModelInput[]): Promise<ModelOutput[]> {
    const results: ModelOutput[] = [];
    
    for (const input of inputs) {
      try {
        const result = await this.generate(input);
        results.push(result);
      } catch (error) {
        // Add error result for failed requests
        results.push({
          text: '',
          metadata: {
            model: this.getModelName(),
            finishReason: 'error',
          },
          rawResponse: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    }

    return results;
  }

  /**
   * Get the model name (to be implemented by concrete classes)
   */
  protected abstract getModelName(): string;

  /**
   * Setup HTTP interceptors for request/response handling
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add authentication header
        if (config.headers) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // API returned an error response
          const statusCode = error.response.status;
          const message = error.response.data?.message || error.message;
          
          if (statusCode === 429) {
            throw new AIModelError(
              'Rate limit exceeded',
              'RATE_LIMIT_EXCEEDED',
              statusCode,
              true
            );
          } else if (statusCode >= 500) {
            throw new AIModelError(
              'Server error',
              'SERVER_ERROR',
              statusCode,
              true
            );
          } else if (statusCode === 401) {
            throw new AIModelError(
              'Invalid API key',
              'INVALID_API_KEY',
              statusCode,
              false
            );
          } else {
            throw new AIModelError(
              message,
              'API_ERROR',
              statusCode,
              false
            );
          }
        } else if (error.request) {
          // Network error
          throw new AIModelError(
            'Network error - no response received',
            'NETWORK_ERROR',
            undefined,
            true
          );
        } else {
          // Other error
          throw new AIModelError(
            error.message,
            'UNKNOWN_ERROR',
            undefined,
            false
          );
        }
      }
    );
  }

  /**
   * Check and enforce rate limits
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitConfig) return;

    const now = Date.now();
    const { maxRequests, windowMs, currentRequests, windowStart } = this.rateLimitConfig;

    // Reset window if needed
    if (now - windowStart >= windowMs) {
      this.rateLimitConfig.currentRequests = 0;
      this.rateLimitConfig.windowStart = now;
    }

    // Check if we've exceeded the rate limit
    if (currentRequests >= maxRequests) {
      const waitTime = windowMs - (now - windowStart);
      throw new AIModelError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`,
        'RATE_LIMIT_EXCEEDED',
        undefined,
        true
      );
    }

    // Increment request count
    this.rateLimitConfig.currentRequests++;
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: ModelInput): void {
    if (!input.prompt || typeof input.prompt !== 'string') {
      throw new AIModelError('Prompt is required and must be a string', 'INVALID_INPUT');
    }

    if (input.maxTokens && (input.maxTokens < 1 || input.maxTokens > 4000)) {
      throw new AIModelError('maxTokens must be between 1 and 4000', 'INVALID_INPUT');
    }

    if (input.temperature && (input.temperature < 0 || input.temperature > 2)) {
      throw new AIModelError('temperature must be between 0 and 2', 'INVALID_INPUT');
    }

    if (input.topP && (input.topP < 0 || input.topP > 1)) {
      throw new AIModelError('topP must be between 0 and 1', 'INVALID_INPUT');
    }
  }

  /**
   * Validate output format
   */
  private validateOutput(output: ModelOutput): void {
    if (!output.text || typeof output.text !== 'string') {
      throw new AIModelError('Invalid output format: text is required', 'INVALID_OUTPUT');
    }
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any): AIModelError {
    if (error instanceof AIModelError) {
      return error;
    }

    if (error.code === 'ECONNABORTED') {
      return new AIModelError(
        'Request timeout',
        'TIMEOUT',
        undefined,
        true
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new AIModelError(
        'Network connection failed',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }

    return new AIModelError(
      error.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      false
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update HTTP client configuration
    if (newConfig.baseUrl) {
      this.httpClient.defaults.baseURL = newConfig.baseUrl;
    }
    
    if (newConfig.timeout) {
      this.httpClient.defaults.timeout = newConfig.timeout;
    }

    // Update rate limiting
    if (newConfig.rateLimit) {
      this.rateLimitConfig = {
        maxRequests: newConfig.rateLimit,
        windowMs: 60000,
        currentRequests: 0,
        windowStart: Date.now(),
      };
    }
  }

  /**
   * Test the connection to the model API
   */
  async testConnection(): Promise<boolean> {
    try {
      const testInput: ModelInput = {
        prompt: 'test',
        maxTokens: 1,
      };
      
      await this.generate(testInput);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { current: number; max: number; resetTime: number } | null {
    if (!this.rateLimitConfig) return null;

    const now = Date.now();
    const { maxRequests, windowMs, currentRequests, windowStart } = this.rateLimitConfig;
    
    const resetTime = windowStart + windowMs;
    const timeUntilReset = Math.max(0, resetTime - now);

    return {
      current: currentRequests,
      max: maxRequests,
      resetTime: timeUntilReset,
    };
  }
}
