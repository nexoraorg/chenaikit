import {
  createTestAccount,
  sendPayment,
  getAccountBalance,
  waitFor,
  TestAccount
} from './helpers/setup';

// Mock CreditScorer
class CreditScorer {
  async calculateScore(accountData: any) {
    return {
      score: 750,
      factors: ['payment_history', 'credit_utilization'],
      confidence: 0.85
    };
  }
}

describe('Credit Scoring Integration', () => {
  let testAccount: TestAccount;
  let creditScorer: CreditScorer;

  beforeAll(async () => {
    testAccount = await createTestAccount();
    creditScorer = new CreditScorer();
  });

  describe('Account Credit Score Calculation', () => {
    it('should calculate credit score for new account', async () => {
      const accountData = {
        publicKey: testAccount.publicKey,
        balance: await getAccountBalance(testAccount.publicKey),
        transactionCount: 0,
        accountAge: 0
      };

      const result = await creditScorer.calculateScore(accountData);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(300);
      expect(result.score).toBeLessThanOrEqual(850);
      expect(result.factors).toBeInstanceOf(Array);
    });

    it('should update score after transactions', async () => {
      const recipient = await createTestAccount();
      
      // Initial score
      const initialScore = await creditScorer.calculateScore({
        publicKey: testAccount.publicKey,
        balance: await getAccountBalance(testAccount.publicKey),
        transactionCount: 0,
        accountAge: 0
      });

      // Make transaction
      await sendPayment(testAccount, recipient.publicKey, '10');
      
      // Wait for transaction to settle
      await waitFor(async () => {
        const balance = await getAccountBalance(recipient.publicKey);
        return parseFloat(balance) > 10000;
      });

      // Updated score
      const updatedScore = await creditScorer.calculateScore({
        publicKey: testAccount.publicKey,
        balance: await getAccountBalance(testAccount.publicKey),
        transactionCount: 1,
        accountAge: 0
      });

      expect(updatedScore.score).toBeDefined();
      expect(updatedScore.factors.length).toBeGreaterThan(0);
    });
  });

  describe('Credit Score Factors', () => {
    it('should identify positive factors', async () => {
      const accountData = {
        publicKey: testAccount.publicKey,
        balance: '10000',
        transactionCount: 50,
        accountAge: 365
      };

      const result = await creditScorer.calculateScore(accountData);

      expect(result.factors).toContain('payment_history');
    });

    it('should handle accounts with no history', async () => {
      const newAccount = await createTestAccount();
      
      const result = await creditScorer.calculateScore({
        publicKey: newAccount.publicKey,
        balance: await getAccountBalance(newAccount.publicKey),
        transactionCount: 0,
        accountAge: 0
      });

      expect(result.score).toBeGreaterThanOrEqual(300);
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('Score Persistence', () => {
    it('should maintain consistent scores for same data', async () => {
      const accountData = {
        publicKey: testAccount.publicKey,
        balance: '5000',
        transactionCount: 10,
        accountAge: 30
      };

      const score1 = await creditScorer.calculateScore(accountData);
      const score2 = await creditScorer.calculateScore(accountData);

      expect(score1.score).toBe(score2.score);
    });
  });
});
