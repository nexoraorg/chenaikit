import {
  ExampleConversation,
  NLPService,
  NLPServiceConfig,
  TrainingExample,
} from '@chenaikit/core';

export interface WalletOperationHandlers {
  checkBalance: () => Promise<string>;
  sendPayment: (params: {
    amount: number;
    destination: string;
    asset: string;
  }) => Promise<string>;
  listTransactions: (timeframe: string) => Promise<string>;
  swapAsset: (params: { amount: number; asset: string }) => Promise<string>;
}

export class WalletChatbotNLPIntegration {
  private readonly nlpService: NLPService;
  private readonly handlers: WalletOperationHandlers;

  constructor(handlers: WalletOperationHandlers, config: NLPServiceConfig = {}) {
    this.handlers = handlers;
    this.nlpService = new NLPService(config);
  }

  async handleUserMessage(
    conversationId: string,
    message: string,
    isConfirmed = false
  ): Promise<string> {
    const result = await this.nlpService.processMessage(conversationId, message);
    const operation = result.operation;

    if (!operation) return result.reply;

    if ((operation.type === 'send_payment' || operation.type === 'swap_asset') && !isConfirmed) {
      return `${result.reply} Reply "confirm" to continue.`;
    }

    if (operation.type === 'get_balance') {
      return this.handlers.checkBalance();
    }

    if (operation.type === 'send_payment') {
      return this.handlers.sendPayment({
        amount: Number(operation.params.amount),
        destination: String(operation.params.destination),
        asset: String(operation.params.asset || 'XLM'),
      });
    }

    if (operation.type === 'get_transactions') {
      return this.handlers.listTransactions(String(operation.params.timeframe || 'recent'));
    }

    if (operation.type === 'swap_asset') {
      return this.handlers.swapAsset({
        amount: Number(operation.params.amount),
        asset: String(operation.params.asset || 'XLM'),
      });
    }

    return result.reply;
  }
}

export const trainingData: TrainingExample[] = [
  { intent: 'check_balance', utterance: 'What is my wallet balance?' },
  { intent: 'check_balance', utterance: 'How much XLM do I have right now?' },
  {
    intent: 'send_payment',
    utterance: 'Send 25 XLM to GABCD1234567890ABCDEFGHJKLMNPQRSTUVWXYZABCD12345',
    entities: [
      { type: 'amount', value: '25' },
      { type: 'asset', value: 'XLM' },
      { type: 'address', value: 'GABCD1234567890ABCDEFGHJKLMNPQRSTUVWXYZABCD12345' },
    ],
  },
  { intent: 'show_transactions', utterance: 'Show my recent transactions' },
  { intent: 'swap_asset', utterance: 'Swap 100 XLM to USDC' },
  { intent: 'request_help', utterance: 'What can you do?' },
];

export const exampleConversations: ExampleConversation[] = [
  {
    name: 'Balance check',
    turns: [
      { user: 'Can you check my wallet balance?', assistant: 'I can fetch your current wallet balance now.' },
      { user: 'Yes, do it.', assistant: 'Your balance is 245.67 XLM.' },
    ],
  },
  {
    name: 'Multi-turn payment',
    turns: [
      {
        user: 'I want to send money',
        assistant: 'I can help with that payment. What amount should I send and to which wallet address?',
      },
      { user: 'Send 30 USDC', assistant: 'Please share the destination wallet address before I prepare the transaction.' },
      {
        user: 'Send to GABCD1234567890ABCDEFGHJKLMNPQRSTUVWXYZABCD12345',
        assistant: 'I can prepare a transfer of 30 USDC to GABCD1234567890ABCDEFGHJKLMNPQRSTUVWXYZABCD12345. Please confirm before I execute anything on-chain.',
      },
    ],
  },
];

