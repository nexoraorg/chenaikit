import { RealTimeFraudScorer } from './fraud/riskScorer';
import { RiskResult, Transaction } from './fraud/types';

export class FraudDetector {
  private scorer = new RealTimeFraudScorer();

  async initializeBaseline(transactions: Transaction[]): Promise<void> {
    this.scorer.fitBaseline(transactions);
  }

  async detectAnomalies(transactionData: Transaction): Promise<boolean> {
    const result = this.scorer.scoreTransaction(transactionData);
    return result.riskScore >= 70; // high risk threshold
  }

  async getRiskFactors(transactionData: Transaction): Promise<string[]> {
    const result = this.scorer.scoreTransaction(transactionData);
    return result.reasons;
  }

  async score(transactionData: Transaction): Promise<RiskResult> {
    return this.scorer.scoreTransaction(transactionData);
  }
}
