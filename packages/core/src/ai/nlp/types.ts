export type WalletIntent =
  | 'check_balance'
  | 'send_payment'
  | 'show_transactions'
  | 'swap_asset'
  | 'request_help'
  | 'unknown';

export type EntityType =
  | 'amount'
  | 'address'
  | 'asset'
  | 'account'
  | 'timeframe'
  | 'memo';

export interface NLPEntity {
  type: EntityType;
  value: string;
  confidence: number;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationContext {
  id: string;
  history: ConversationMessage[];
  pendingIntent?: WalletIntent;
  metadata?: {
    lastOperation?: BlockchainOperationRequest;
    awaitingConfirmation?: boolean;
  };
}

export interface IntentClassification {
  intent: WalletIntent;
  confidence: number;
  entities: NLPEntity[];
  missingEntities: EntityType[];
  requiresConfirmation: boolean;
}

export type BlockchainOperationType =
  | 'get_balance'
  | 'send_payment'
  | 'get_transactions'
  | 'swap_asset'
  | 'help';

export interface BlockchainOperationRequest {
  type: BlockchainOperationType;
  params: Record<string, string | number | boolean>;
  safetyChecks: string[];
}

export interface NLPProcessResult {
  intent: IntentClassification;
  operation?: BlockchainOperationRequest;
  reply: string;
  context: ConversationContext;
}

export interface ContextStore {
  get(conversationId: string): Promise<ConversationContext | null>;
  save(context: ConversationContext): Promise<void>;
  clear(conversationId: string): Promise<void>;
}

export interface NLPServiceConfig {
  provider?: 'openai' | 'huggingface' | 'rule-based';
  apiKey?: string;
  modelVersion?: string;
  maxHistory?: number;
  confidenceThreshold?: number;
  contextStore?: ContextStore;
  systemPrompt?: string;
}

export interface TrainingExample {
  intent: WalletIntent;
  utterance: string;
  entities?: Array<Pick<NLPEntity, 'type' | 'value'>>;
}

export interface ExampleConversation {
  name: string;
  turns: Array<{ user: string; assistant: string }>;
}

