import { CreditScorer } from '../credit-scorer';

describe('CreditScorer', () => {
  let creditScorer: CreditScorer;

  beforeEach(() => {
    creditScorer = new CreditScorer();
  });

  describe('calculateScore', () => {
    it('should throw error as not implemented', async () => {
      const accountData = { accountId: 'G123', balance: '1000' };
      await expect(creditScorer.calculateScore(accountData))
        .rejects.toThrow('Not implemented yet - see issue #25');
    });
  });

  describe('getScoreFactors', () => {
    it('should throw error as not implemented', async () => {
      const accountData = { accountId: 'G123', balance: '1000' };
      await expect(creditScorer.getScoreFactors(accountData))
        .rejects.toThrow('Not implemented yet - see issue #25');
    });
  });
});
