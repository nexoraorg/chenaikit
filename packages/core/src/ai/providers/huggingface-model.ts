import { AIModel, ModelConfig, ModelInput, ModelOutput } from '../base-model';
import { HuggingFaceConfig } from '../types';

/**
 * Hugging Face model implementation
 * Extends the base AIModel class for Hugging Face API integration
 */
export class HuggingFaceModel extends AIModel {
  private modelVersion: string;
  private useAuth: boolean;

  constructor(config: HuggingFaceConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api-inference.huggingface.co/models',
    });
    
    this.modelVersion = config.modelVersion;
    this.useAuth = config.useAuth || false;
  }

  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    const requestBody = this.buildRequestBody(input);
    
    const response = await this.httpClient.post(`/${this.modelVersion}`, requestBody);
    
    return this.parseResponse(response);
  }

  protected getModelName(): string {
    return this.modelVersion;
  }

  /**
   * Build Hugging Face-specific request body
   */
  private buildRequestBody(input: ModelInput): any {
    return {
      inputs: input.prompt,
      parameters: {
        max_new_tokens: input.maxTokens || 100,
        temperature: input.temperature || 0.7,
        top_p: input.topP || 0.9,
        do_sample: true,
        return_full_text: false,
        ...input.parameters,
      },
    };
  }

  /**
   * Parse Hugging Face response format
   */
  private parseResponse(response: any): ModelOutput {
    const data = response.data;
    
    // Handle different response formats
    let text: string;
    let tokensUsed: number | undefined;

    if (Array.isArray(data) && data.length > 0) {
      // Text generation response
      text = data[0].generated_text || data[0].text || '';
    } else if (data.generated_text) {
      // Single response
      text = data.generated_text;
    } else if (data.text) {
      text = data.text;
    } else {
      text = JSON.stringify(data);
    }

    return {
      text,
      tokensUsed,
      metadata: {
        model: this.modelVersion,
        finishReason: 'stop',
        provider: 'huggingface',
      },
      rawResponse: data,
    };
  }

  /**
   * Get model capabilities
   */
  getCapabilities() {
    return {
      textGeneration: true,
      chat: false, // Most HF models are not conversational
      streaming: false,
      batchProcessing: true,
      maxContextLength: 1024, // Default for most HF models
      languages: ['en'], // Depends on the specific model
    };
  }

  /**
   * Check if model is loaded (Hugging Face specific)
   */
  async checkModelStatus(): Promise<{ loaded: boolean; loading?: boolean }> {
    try {
      const response = await this.httpClient.get(`/${this.modelVersion}`);
      return {
        loaded: true,
        loading: false,
      };
    } catch (error: any) {
      if (error.response?.status === 503) {
        return {
          loaded: false,
          loading: true,
        };
      }
      throw error;
    }
  }
}
