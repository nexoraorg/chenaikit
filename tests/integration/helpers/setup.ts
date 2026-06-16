import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';

export interface TestAccount {
  keypair: StellarSdk.Keypair;
  publicKey: string;
  secretKey: string;
}

export interface TestEnvironment {
  server: StellarSdk.Horizon.Server;
  networkPassphrase: string;
  accounts: TestAccount[];
}

let testEnv: TestEnvironment | null = null;

/**
 * Setup Stellar testnet environment
 */
export async function setupStellarTestnet(): Promise<TestEnvironment> {
  if (testEnv) return testEnv;

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
  const networkPassphrase = StellarSdk.Networks.TESTNET;

  testEnv = {
    server,
    networkPassphrase,
    accounts: []
  };

  return testEnv;
}

/**
 * Create and fund a testnet account
 */
export async function createTestAccount(): Promise<TestAccount> {
  const keypair = StellarSdk.Keypair.random();
  
  try {
    // Fund account using Friendbot
    await axios.get(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
    
    // Wait for account to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const account: TestAccount = {
      keypair,
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret()
    };
    
    if (testEnv) {
      testEnv.accounts.push(account);
    }
    
    return account;
  } catch (error) {
    throw new Error(`Failed to create test account: ${error}`);
  }
}

/**
 * Get account balance
 */
export async function getAccountBalance(publicKey: string): Promise<string> {
  if (!testEnv) throw new Error('Test environment not initialized');
  
  const account = await testEnv.server.loadAccount(publicKey);
  const nativeBalance = account.balances.find(b => b.asset_type === 'native');
  return nativeBalance?.balance || '0';
}

/**
 * Send payment between test accounts
 */
export async function sendPayment(
  from: TestAccount,
  to: string,
  amount: string
): Promise<string> {
  if (!testEnv) throw new Error('Test environment not initialized');
  
  const sourceAccount = await testEnv.server.loadAccount(from.publicKey);
  
  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: testEnv.networkPassphrase
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: to,
        asset: StellarSdk.Asset.native(),
        amount
      })
    )
    .setTimeout(30)
    .build();
  
  transaction.sign(from.keypair);
  
  const result = await testEnv.server.submitTransaction(transaction);
  return result.hash;
}

/**
 * Mock AI API responses
 */
export function mockAIService() {
  return {
    calculateCreditScore: jest.fn().mockResolvedValue({
      score: 750,
      factors: ['payment_history', 'credit_utilization'],
      confidence: 0.85
    }),
    detectFraud: jest.fn().mockResolvedValue({
      isFraudulent: false,
      riskScore: 25,
      reasons: []
    })
  };
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(): Promise<void> {
  testEnv = null;
}

/**
 * Generate test transaction data
 */
export function generateTestTransaction(overrides: any = {}) {
  return {
    id: `test_tx_${Date.now()}`,
    hash: `hash_${Math.random().toString(36).substr(2, 9)}`,
    sourceAccount: 'GTEST...',
    amount: '100',
    timestamp: new Date().toISOString(),
    successful: true,
    ...overrides
  };
}

/**
 * Setup global test environment
 */
beforeAll(async () => {
  await setupStellarTestnet();
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  await cleanupTestEnvironment();
});
