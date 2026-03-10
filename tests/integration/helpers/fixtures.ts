import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Test data fixtures for integration tests
 */

export const MOCK_ACCOUNTS = {
  alice: {
    publicKey: 'GALICE...',
    secretKey: 'SALICE...'
  },
  bob: {
    publicKey: 'GBOB...',
    secretKey: 'SBOB...'
  },
  charlie: {
    publicKey: 'GCHARLIE...',
    secretKey: 'SCHARLIE...'
  }
};

export const MOCK_TRANSACTIONS = [
  {
    id: 'tx_001',
    hash: 'hash_001',
    sourceAccount: 'GALICE...',
    destination: 'GBOB...',
    amount: '100',
    timestamp: '2026-03-09T10:00:00Z',
    successful: true
  },
  {
    id: 'tx_002',
    hash: 'hash_002',
    sourceAccount: 'GBOB...',
    destination: 'GCHARLIE...',
    amount: '50',
    timestamp: '2026-03-09T10:05:00Z',
    successful: true
  },
  {
    id: 'tx_003',
    hash: 'hash_003',
    sourceAccount: 'GCHARLIE...',
    destination: 'GALICE...',
    amount: '25',
    timestamp: '2026-03-09T10:10:00Z',
    successful: true
  }
];

export const MOCK_CREDIT_SCORES = {
  excellent: {
    score: 800,
    factors: ['payment_history', 'credit_utilization', 'account_age'],
    confidence: 0.95
  },
  good: {
    score: 700,
    factors: ['payment_history', 'account_age'],
    confidence: 0.85
  },
  fair: {
    score: 600,
    factors: ['payment_history'],
    confidence: 0.70
  },
  poor: {
    score: 450,
    factors: [],
    confidence: 0.50
  }
};

export const MOCK_FRAUD_RESULTS = {
  clean: {
    isFraudulent: false,
    riskScore: 10,
    reasons: []
  },
  suspicious: {
    isFraudulent: false,
    riskScore: 65,
    reasons: ['unusual_amount', 'new_destination']
  },
  fraudulent: {
    isFraudulent: true,
    riskScore: 95,
    reasons: ['rapid_transactions', 'high_value', 'suspicious_pattern']
  }
};

export const MOCK_ACCOUNT_DATA = {
  newAccount: {
    publicKey: 'GNEW...',
    balance: '10000',
    transactionCount: 0,
    accountAge: 0
  },
  activeAccount: {
    publicKey: 'GACTIVE...',
    balance: '50000',
    transactionCount: 100,
    accountAge: 365
  },
  whaleAccount: {
    publicKey: 'GWHALE...',
    balance: '10000000',
    transactionCount: 500,
    accountAge: 730
  }
};

export const MOCK_ALERT_RULES = {
  highValue: {
    id: 'rule_high_value',
    name: 'High Value Transaction',
    type: 'high_value',
    severity: 'medium',
    threshold: 10000,
    enabled: true
  },
  rapidTransactions: {
    id: 'rule_rapid',
    name: 'Rapid Transactions',
    type: 'rapid_transactions',
    severity: 'high',
    threshold: 20,
    windowMs: 300000,
    enabled: true
  },
  suspiciousPattern: {
    id: 'rule_suspicious',
    name: 'Suspicious Pattern',
    type: 'suspicious_pattern',
    severity: 'critical',
    threshold: 0.8,
    enabled: true
  }
};

export const MOCK_API_RESPONSES = {
  health: {
    status: 'healthy',
    timestamp: '2026-03-09T14:00:00Z',
    uptime: 3600,
    version: '0.1.0'
  },
  authSuccess: {
    success: true,
    token: 'mock_jwt_token',
    refreshToken: 'mock_refresh_token',
    expiresIn: 3600
  },
  creditScore: {
    success: true,
    data: {
      score: 750,
      factors: ['payment_history', 'credit_utilization'],
      timestamp: '2026-03-09T14:00:00Z'
    }
  },
  fraudDetection: {
    success: true,
    data: {
      riskScore: 25,
      riskLevel: 'low',
      factors: ['transaction_amount', 'location'],
      timestamp: '2026-03-09T14:00:00Z'
    }
  }
};

/**
 * Generate random transaction
 */
export function generateRandomTransaction(overrides: any = {}) {
  return {
    id: `tx_${Math.random().toString(36).substr(2, 9)}`,
    hash: `hash_${Math.random().toString(36).substr(2, 9)}`,
    sourceAccount: `G${Math.random().toString(36).substr(2, 9).toUpperCase()}...`,
    destination: `G${Math.random().toString(36).substr(2, 9).toUpperCase()}...`,
    amount: (Math.random() * 1000).toFixed(2),
    timestamp: new Date().toISOString(),
    successful: true,
    ...overrides
  };
}

/**
 * Generate batch of transactions
 */
export function generateTransactionBatch(count: number, overrides: any = {}) {
  return Array.from({ length: count }, () => generateRandomTransaction(overrides));
}

/**
 * Create mock Stellar account
 */
export function createMockStellarAccount() {
  const keypair = StellarSdk.Keypair.random();
  return {
    keypair,
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret()
  };
}
