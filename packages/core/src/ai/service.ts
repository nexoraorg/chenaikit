import { AIConfig } from './types';
import { FraudDetector } from './fraud-detector';
import { FraudDetectionResult, RawTransaction, RealTimeScoringOptions } from './fraud/types';

export class AIService {
  private config: AIConfig;
  private fraudDetector: FraudDetector;

  constructor(config: AIConfig) {
    this.config = config;
    this.fraudDetector = new FraudDetector();
  }

  async calculateCreditScore(accountData: any): Promise<number> {
    // TODO: Implement credit scoring logic - Issue #25
    throw new Error('Not implemented yet - see issue #25');
  }

  async detectFraud(transactionData: RawTransaction, opts: RealTimeScoringOptions = {}): Promise<FraudDetectionResult> {
    return this.fraudDetector.detect(transactionData, opts);
  }
}
