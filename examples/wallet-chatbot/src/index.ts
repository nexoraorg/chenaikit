// Wallet Chatbot - Example application
console.log('Wallet Chatbot starting...');

import { WalletChatbotNLPIntegration } from './nlp-integration';

const chatbot = new WalletChatbotNLPIntegration(
  {
    checkBalance: async () => 'Your balance is 1000 XLM.',
    sendPayment: async ({ amount, destination, asset }) =>
      `Prepared ${amount} ${asset} transfer to ${destination}.`,
    listTransactions: async (timeframe) => `Showing ${timeframe} transaction history.`,
    swapAsset: async ({ amount, asset }) => `Prepared swap for ${amount} into ${asset}.`,
  },
  {
    provider: 'rule-based',
  }
);

// Example NLP-powered message processing
export async function processMessage(
  message: string,
  conversationId = 'demo-session'
): Promise<string> {
  return chatbot.handleUserMessage(conversationId, message);
}

// TODO: Implement wallet operations
export function getBalance(accountId: string): number {
  // Placeholder implementation
  return 1000;
}
