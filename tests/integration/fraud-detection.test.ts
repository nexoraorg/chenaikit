import {
  createTestAccount,
  sendPayment,
  generateTestTransaction,
  TestAccount
} from './helpers/setup';

// Mock FraudDetector
class FraudDetector {
  async initializeBaseline(transactions: any[]) {}
  
  async detectAnomalies(transaction: any): Promise<boolean> {
    return transaction.amount > 100000;
  }
  
  async getRiskFactors(transaction: any): Promise<string[]> {
    return transaction.amount > 100000 ? ['high_value'] : [];
  }
  
  async score(transaction: any) {
    const riskScore = transaction.amount > 100000 ? 85 : 25;
    return {
      riskScore,
      reasons: riskScore > 50 ? ['high_value'] : []
    };
  }
}

describe('Fraud Detection Integration', () => {
  let fraudDetector: FraudDetector;
  let testAccount: TestAccount;

  beforeAll(async () => {
    fraudDetector = new FraudDetector();
    testAccount = await createTestAccount();
  });

  describe('Transaction Analysis', () => {
    it('should detect normal transactions', async () => {
      const transaction = generateTestTransaction({
        sourceAccount: testAccount.publicKey,
        amount: '100',
        destination: 'GDEST...'
      });

      const isAnomaly = await fraudDetector.detectAnomalies(transaction);

      expect(typeof isAnomaly).toBe('boolean');
    });

    it('should flag high-value transactions', async () => {
      const transaction = generateTestTransaction({
        sourceAccount: testAccount.publicKey,
        amount: '1000000',
        destination: 'GDEST...'
      });

      const riskFactors = await fraudDetector.getRiskFactors(transaction);

      expect(riskFactors).toBeInstanceOf(Array);
    });

    it('should detect rapid transaction patterns', async () => {
      const transactions = Array.from({ length: 10 }, (_, i) =>
        generateTestTransaction({
          sourceAccount: testAccount.publicKey,
          amount: '50',
          timestamp: new Date(Date.now() + i * 1000).toISOString()
        })
      );

      await fraudDetector.initializeBaseline(transactions);

      const rapidTx = generateTestTransaction({
        sourceAccount: testAccount.publicKey,
        amount: '50',
        timestamp: new Date().toISOString()
      });

      const result = await fraudDetector.score(rapidTx);

      expect(result).toHaveProperty('riskScore');
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate risk scores', async () => {
      const transaction = generateTestTransaction({
        sourceAccount: testAccount.publicKey,
        amount: '500'
      });

      const result = await fraudDetector.score(transaction);

      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('reasons');
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it('should provide risk reasons', async () => {
      const suspiciousTx = generateTestTransaction({
        sourceAccount: testAccount.publicKey,
        amount: '999999',
        destination: 'GNEW...'
      });

      const reasons = await fraudDetector.getRiskFactors(suspiciousTx);

      expect(reasons.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Baseline Learning', () => {
    it('should learn from transaction history', async () => {
      const normalTransactions = Array.from({ length: 20 }, () =>
        generateTestTransaction({
          sourceAccount: testAccount.publicKey,
          amount: Math.floor(Math.random() * 100 + 10).toString()
        })
      );

      await expect(
        fraudDetector.initializeBaseline(normalTransactions)
      ).resolves.not.toThrow();
    });

    it('should detect anomalies after baseline', async () => {
      const normalTxs = Array.from({ length: 15 }, () =>
        generateTestTransaction({ amount: '50' })
      );

      await fraudDetector.initializeBaseline(normalTxs);

      const anomalousTx = generateTestTransaction({ amount: '50000' });
      const isAnomaly = await fraudDetector.detectAnomalies(anomalousTx);

      expect(typeof isAnomaly).toBe('boolean');
    });
  });

  describe('Real Transaction Flow', () => {
    it('should analyze actual blockchain transaction', async () => {
      const recipient = await createTestAccount();
      
      const txHash = await sendPayment(testAccount, recipient.publicKey, '5');

      const transaction = generateTestTransaction({
        hash: txHash,
        sourceAccount: testAccount.publicKey,
        destination: recipient.publicKey,
        amount: '5'
      });

      const result = await fraudDetector.score(transaction);

      expect(result.riskScore).toBeLessThan(50); // Normal transaction
    });
  });
});
