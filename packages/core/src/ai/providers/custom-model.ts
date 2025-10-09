import { AIModel, ModelConfig, ModelInput, ModelOutput } from '../base-model';
import { CustomModelConfig } from '../types';

/**
 * Custom model implementation
 * Extends the base AIModel class for custom API integration
 */
export class CustomModel extends AIModel {
  private modelVersion: string;
  private customEndpoint: string;

  constructor(config: CustomModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || config.customEndpoint,
    });
    
    this.modelVersion = config.modelVersion;
    this.customEndpoint = config.customEndpoint;
  }

  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    const requestBody = this.buildRequestBody(input);
    
    const response = await this.httpClient.post('/', requestBody);
    
    return this.parseResponse(response);
  }

  protected getModelName(): string {
    return this.modelVersion;
  }

  /**
   * Build custom model request body
   * This is a generic implementation that can be overridden
   */
  private buildRequestBody(input: ModelInput): any {
    return {
      prompt: input.prompt,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      top_p: input.topP,
      stop: input.stopSequences,
      ...input.parameters,
    };
  }

  /**
   * Parse custom model response
   * This is a generic implementation that can be overridden
   */
  private parseResponse(response: any): ModelOutput {
    const data = response.data;
    
    // Try to extract text from common response formats
    let text: string;
    
    if (data.text) {
      text = data.text;
    } else if (data.response) {
      text = data.response;
    } else if (data.output) {
      text = data.output;
    } else if (data.content) {
      text = data.content;
    } else if (typeof data === 'string') {
      text = data;
    } else {
      text = JSON.stringify(data);
    }

    return {
      text,
      tokensUsed: data.tokens_used || data.tokensUsed,
      metadata: {
        model: this.modelVersion,
        finishReason: data.finish_reason || 'stop',
        provider: 'custom',
      },
      rawResponse: data,
    };
  }

  /**
   * Get model capabilities
   * Default implementation - should be overridden for specific models
   */
  getCapabilities() {
    return {
      textGeneration: true,
      chat: false,
      streaming: false,
      batchProcessing: true,
      maxContextLength: 2048,
      languages: ['en'],
    };
  }

  /**
   * Override this method to customize request body format
   */
  protected buildCustomRequestBody(input: ModelInput): any {
    return this.buildRequestBody(input);
  }

  /**
   * Override this method to customize response parsing
   */
  protected parseCustomResponse(response: any): ModelOutput {
    return this.parseResponse(response);
  }
}
