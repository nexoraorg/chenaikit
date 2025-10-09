import { AIModel, ModelConfig, ModelInput, ModelOutput } from '../base-model';
import { OpenAIConfig } from '../types';

/**
 * OpenAI model implementation
 * Extends the base AIModel class for OpenAI API integration
 */
export class OpenAIModel extends AIModel {
  private modelVersion: string;
  private organization?: string;

  constructor(config: OpenAIConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
    });
    
    this.modelVersion = config.modelVersion;
    this.organization = config.organization;
  }

  protected async makeRequest(input: ModelInput): Promise<ModelOutput> {
    const requestBody = this.buildRequestBody(input);
    
    const response = await this.httpClient.post('/chat/completions', requestBody);
    
    return this.parseResponse(response);
  }

  protected getModelName(): string {
    return this.modelVersion;
  }

  /**
   * Build OpenAI-specific request body
   */
  private buildRequestBody(input: ModelInput): any {
    const messages = this.buildMessages(input);
    
    return {
      model: this.modelVersion,
      messages,
      max_tokens: input.maxTokens || 1000,
      temperature: input.temperature || 0.7,
      top_p: input.topP || 1,
      stop: input.stopSequences,
      ...input.parameters,
    };
  }

  /**
   * Build messages array for OpenAI chat format
   */
  private buildMessages(input: ModelInput): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system message if provided
    if (input.systemMessage) {
      messages.push({
        role: 'system',
        content: input.systemMessage,
      });
    }

    // Use provided messages or create from prompt
    if (input.messages && input.messages.length > 0) {
      messages.push(...input.messages);
    } else {
      messages.push({
        role: 'user',
        content: input.prompt,
      });
    }

    return messages;
  }

  /**
   * Parse OpenAI response format
   */
  private parseResponse(response: any): ModelOutput {
    const choice = response.data.choices[0];
    const usage = response.data.usage;

    return {
      text: choice.message.content,
      tokensUsed: usage?.total_tokens,
      metadata: {
        model: response.data.model,
        finishReason: choice.finish_reason,
        provider: 'openai',
      },
      rawResponse: response.data,
    };
  }

  /**
   * Get model capabilities
   */
  getCapabilities() {
    return {
      textGeneration: true,
      chat: true,
      streaming: true,
      batchProcessing: true,
      maxContextLength: this.getMaxContextLength(),
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    };
  }

  /**
   * Get maximum context length based on model version
   */
  private getMaxContextLength(): number {
    const contextLengths: Record<string, number> = {
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
    };

    return contextLengths[this.modelVersion] || 4096;
  }
}
