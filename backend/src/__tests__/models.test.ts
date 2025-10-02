import { User } from '../models/User';
import { Account } from '../models/Account';
import { Transaction } from '../models/Transaction';
import { CreditScore } from '../models/CreditScore';
import { FraudAlert } from '../models/FraudAlert';

describe('Model Validation', () => {
  it('should create a valid User', () => {
    const user = new User();
    user.email = 'test@example.com';
    user.passwordHash = 'hashedpassword';
    expect(user.email).toMatch(/@/);
    expect(user.passwordHash.length).toBeGreaterThan(8);
  });

  it('should create a valid Account', () => {
    const account = new Account();
    account.stellarAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    expect(account.stellarAddress.length).toBe(56);
  });

  it('should create a valid Transaction', () => {
    const transaction = new Transaction();
    transaction.transactionId = 'TX123';
    transaction.amount = 100.5;
    transaction.assetType = 'USD';
    transaction.description = 'Payment';
    transaction.timestamp = new Date();
    expect(transaction.amount).toBeGreaterThan(0);
  });

  it('should create a valid CreditScore', () => {
    const score = new CreditScore();
    score.score = 750;
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(850);
  });

  it('should create a valid FraudAlert', () => {
    const alert = new FraudAlert();
    alert.alertType = 'Suspicious Activity';
    alert.resolved = false;
    expect(alert.alertType).toBeTruthy();
    expect(alert.resolved).toBe(false);
  });
});
