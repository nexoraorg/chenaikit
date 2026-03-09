import { AIModel } from '../base-model';
import { HuggingFaceModel } from '../providers/huggingface-model';
import { OpenAIModel } from '../providers/openai-model';
import {
  buildBlockchainOperation,
  classifyIntentRuleBased,
  followUpQuestion,
  inferMissingEntities,
  mergeEntities,
} from './intents';
import {
  ContextStore,
  ConversationContext,
  ConversationMessage,
  IntentClassification,
  NLPProcessResult,
  NLPServiceConfig,
  WalletIntent,
} from './types';

export class InMemoryContextStore implements ContextStore {
  private store = new Map<string, ConversationContext>();

  async get(conversationId: string): Promise<ConversationContext | null> {
    return this.store.get(conversationId) || null;
  }

  async save(context: ConversationContext): Promise<void> {
    this.store.set(context.id, context);
  }

  async clear(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
  }
}

export class NLPService {
  private readonly config: Required<
    Pick<NLPServiceConfig, 'provider' | 'maxHistory' | 'confidenceThreshold'>
  > &
    Omit<NLPServiceConfig, 'provider' | 'maxHistory' | 'confidenceThreshold'>;
  private readonly contextStore: ContextStore;
  private readonly model?: AIModel;

  constructor(config: NLPServiceConfig = {}) {
    this.config = {
      provider: config.provider || 'rule-based',
      maxHistory: config.maxHistory || 12,
      confidenceThreshold: config.confidenceThreshold || 0.6,
      ...config,
    };
    this.contextStore = config.contextStore || new InMemoryContextStore();
    this.model = this.buildModel();
  }

  async processMessage(
    conversationId: string,
    userMessage: string
  ): Promise<NLPProcessResult> {
    const context = (await this.contextStore.get(conversationId)) || this.createContext(conversationId);
    context.history.push(this.buildMessage('user', userMessage));

    let classification = await this.classify(userMessage, context);
    classification = this.applyMultiTurnContext(context, classification);

    const operation = buildBlockchainOperation(classification);
    const reply = this.composeReply(classification, operation);

    context.pendingIntent = classification.missingEntities.length ? classification.intent : undefined;
    context.metadata = {
      lastOperation: operation,
      awaitingConfirmation:
        Boolean(operation) && (classification.intent === 'send_payment' || classification.intent === 'swap_asset'),
    };
    context.history.push(this.buildMessage('assistant', reply));
    context.history = context.history.slice(-this.config.maxHistory);

    await this.contextStore.save(context);
    return { intent: classification, operation, reply, context };
  }

  async resetConversation(conversationId: string): Promise<void> {
    await this.contextStore.clear(conversationId);
  }

  private buildModel(): AIModel | undefined {
    if (!this.config.apiKey) return undefined;

    if (this.config.provider === 'openai') {
      return new OpenAIModel({
        provider: 'openai',
        apiKey: this.config.apiKey,
        modelVersion: this.config.modelVersion || 'gpt-4-turbo',
      });
    }

    if (this.config.provider === 'huggingface') {
      return new HuggingFaceModel({
        provider: 'huggingface',
        apiKey: this.config.apiKey,
        modelVersion: this.config.modelVersion || 'microsoft/DialoGPT-medium',
      });
    }

    return undefined;
  }

  private async classify(
    input: string,
    context: ConversationContext
  ): Promise<IntentClassification> {
    if (!this.model) {
      return classifyIntentRuleBased(input);
    }

    try {
      const response = await this.model.generate({
        prompt: this.buildClassificationPrompt(input),
        temperature: 0.1,
        maxTokens: 300,
        systemMessage:
          this.config.systemPrompt ||
          'Classify wallet assistant intents and extract entities as strict JSON.',
        messages: context.history.slice(-6).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      });

      return this.parseModelClassification(response.text, input);
    } catch {
      return classifyIntentRuleBased(input);
    }
  }

  private buildClassificationPrompt(input: string): string {
    return [
      'Use this schema only:',
      '{"intent":"check_balance|send_payment|show_transactions|swap_asset|request_help|unknown","confidence":0-1,"entities":[{"type":"amount|address|asset|account|timeframe|memo","value":"...","confidence":0-1}]}',
      `Message: "${input}"`,
    ].join('\n');
  }

  private parseModelClassification(raw: string, userInput: string): IntentClassification {
    const fallback = classifyIntentRuleBased(userInput);
    const jsonSegment = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonSegment) return fallback;

    try {
      const parsed = JSON.parse(jsonSegment) as {
        intent?: WalletIntent;
        confidence?: number;
        entities?: Array<{ type: string; value: string; confidence?: number }>;
      };

      const allowed: WalletIntent[] = [
        'check_balance',
        'send_payment',
        'show_transactions',
        'swap_asset',
        'request_help',
        'unknown',
      ];
      const intent: WalletIntent = allowed.includes(parsed.intent as WalletIntent)
        ? (parsed.intent as WalletIntent)
        : fallback.intent;

      const entities = (parsed.entities || [])
        .map((entity) => ({
          type: entity.type as
            | 'amount'
            | 'address'
            | 'asset'
            | 'account'
            | 'timeframe'
            | 'memo',
          value: entity.value,
          confidence: entity.confidence || 0.7,
        }))
        .filter((entity) => entity.value);

      const mergedEntities = mergeEntities(fallback.entities, entities);
      const confidence = Math.max(0, Math.min(1, parsed.confidence || fallback.confidence));

      return {
        intent,
        confidence,
        entities: mergedEntities,
        missingEntities: inferMissingEntities(intent, mergedEntities),
        requiresConfirmation: intent === 'send_payment' || intent === 'swap_asset',
      };
    } catch {
      return fallback;
    }
  }

  private applyMultiTurnContext(
    context: ConversationContext,
    classification: IntentClassification
  ): IntentClassification {
    if (
      context.pendingIntent &&
      classification.intent === 'unknown' &&
      classification.entities.length > 0
    ) {
      const merged = {
        ...classification,
        intent: context.pendingIntent,
        confidence: Math.max(0.75, classification.confidence),
      };
      merged.missingEntities = inferMissingEntities(merged.intent, merged.entities);
      merged.requiresConfirmation = merged.intent === 'send_payment' || merged.intent === 'swap_asset';
      return merged;
    }

    if (context.pendingIntent && classification.intent === context.pendingIntent) {
      classification.missingEntities = inferMissingEntities(classification.intent, classification.entities);
    }

    return classification;
  }

  private composeReply(
    classification: IntentClassification,
    operation: NLPProcessResult['operation']
  ): string {
    if (classification.intent === 'unknown') {
      return 'I can help with balance checks, payments, swaps, and transaction history. What would you like to do?';
    }

    if (classification.missingEntities.length > 0) {
      return followUpQuestion(classification.intent, classification.missingEntities);
    }

    if (!operation) {
      return 'I understood the request, but could not map it to a wallet operation safely.';
    }

    if (operation.type === 'send_payment') {
      const amount = operation.params.amount;
      const destination = operation.params.destination;
      return `I can prepare a transfer of ${amount} ${operation.params.asset} to ${destination}. Please confirm before I execute anything on-chain.`;
    }

    if (operation.type === 'swap_asset') {
      return `I can prepare a swap for ${operation.params.amount} into ${operation.params.asset}. Please confirm the trade before execution.`;
    }

    if (operation.type === 'get_balance') {
      return 'I can fetch your current wallet balance now.';
    }

    if (operation.type === 'get_transactions') {
      return `I can fetch your ${operation.params.timeframe} transaction history now.`;
    }

    return 'Here are the wallet actions I support: check balance, send payment, show transactions, and swap assets.';
  }

  private createContext(conversationId: string): ConversationContext {
    return {
      id: conversationId,
      history: [],
    };
  }

  private buildMessage(role: ConversationMessage['role'], content: string): ConversationMessage {
    return {
      role,
      content,
      timestamp: Date.now(),
    };
  }
}

