/**
 * Shared scoring payloads + version transforms (compatibility layer).
 *
 * A single canonical model is produced once and then transformed into each
 * API version's response shape. This keeps business logic in one place while
 * letting versions evolve their wire formats independently — the basis of a
 * backward-compatibility / data-transformation layer.
 */

/** Canonical, version-agnostic credit assessment. */
export interface CanonicalCreditScore {
  score: number;
  factors: string[];
  generatedAt: string;
}

/** Canonical, version-agnostic fraud assessment. */
export interface CanonicalFraudResult {
  riskScore: number;
  factors: string[];
  generatedAt: string;
}

export function generateCreditScore(): CanonicalCreditScore {
  return {
    score: Math.floor(Math.random() * 850) + 150,
    factors: ['payment_history', 'credit_utilization', 'account_age'],
    generatedAt: new Date().toISOString(),
  };
}

export function generateFraudResult(): CanonicalFraudResult {
  return {
    riskScore: Math.floor(Math.random() * 100),
    factors: ['transaction_amount', 'location', 'device'],
    generatedAt: new Date().toISOString(),
  };
}

function riskLevel(riskScore: number): 'low' | 'medium' | 'high' {
  if (riskScore < 33) return 'low';
  if (riskScore < 66) return 'medium';
  return 'high';
}

/* -------------------------------------------------------------------------- */
/* v1 transforms: flat shape (original contract).                             */
/* -------------------------------------------------------------------------- */

export function toCreditScoreV1(c: CanonicalCreditScore) {
  return {
    score: c.score,
    factors: c.factors,
    timestamp: c.generatedAt,
  };
}

export function toFraudResultV1(c: CanonicalFraudResult) {
  return {
    riskScore: c.riskScore,
    riskLevel: riskLevel(c.riskScore),
    factors: c.factors,
    timestamp: c.generatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* v2 transforms: nested, richer shape (breaking change vs v1).               */
/* -------------------------------------------------------------------------- */

export function toCreditScoreV2(c: CanonicalCreditScore) {
  return {
    creditScore: {
      value: c.score,
      band: c.score >= 700 ? 'excellent' : c.score >= 580 ? 'fair' : 'poor',
      // v2 promotes factors to objects so weights can be communicated.
      factors: c.factors.map((name) => ({ name, weight: null as number | null })),
    },
    meta: {
      generatedAt: c.generatedAt,
      model: 'credit-score-v2',
    },
  };
}

export function toFraudResultV2(c: CanonicalFraudResult) {
  return {
    fraud: {
      riskScore: c.riskScore,
      riskLevel: riskLevel(c.riskScore),
      factors: c.factors.map((name) => ({ name, weight: null as number | null })),
    },
    meta: {
      generatedAt: c.generatedAt,
      model: 'fraud-detect-v2',
    },
  };
}
