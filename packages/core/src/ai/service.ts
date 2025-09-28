import { AIConfig } from './types';

export class AIService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async calculateCreditScore(accountData: any): Promise<number> {
    // TODO: Implement credit scoring logic - Issue #25
    throw new Error('Not implemented yet - see issue #25');
  }

  async detectFraud(transactionData: any): Promise<boolean> {
    // TODO: Implement fraud detection logic - Issue #28
    throw new Error('Not implemented yet - see issue #28');
  }
}
