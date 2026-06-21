import { useState, useEffect } from 'react';
import { CreditScoreData, CreditScoreHistory, RiskFactor } from '../types/credit-score';

export interface UseCreditScoreOptions {
  accountId?: string;
  userId?: string;
  mockData?: boolean;
}

export interface UseCreditScoreResult {
  data: CreditScoreData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const generateMockRiskFactors = (score: number): RiskFactor[] => {
  const factors: RiskFactor[] = [];

  if (score >= 85) {
    factors.push(
      { id: '1', description: 'Excellent payment history with no missed payments', impact: 'positive', severity: 'high' },
      { id: '2', description: 'High transaction volume demonstrates active usage', impact: 'positive', severity: 'medium' },
      { id: '3', description: 'Account age over 2 years shows stability', impact: 'positive', severity: 'medium' }
    );
  } else if (score >= 70) {
    factors.push(
      { id: '1', description: 'Good payment history with occasional delays', impact: 'positive', severity: 'medium' },
      { id: '2', description: 'Moderate transaction frequency', impact: 'positive', severity: 'low' },
      { id: '3', description: 'Recent spike in transaction volume may indicate risk', impact: 'negative', severity: 'low' }
    );
  } else if (score >= 40) {
    factors.push(
      { id: '1', description: 'Inconsistent payment patterns detected', impact: 'negative', severity: 'medium' },
      { id: '2', description: 'Low account balance relative to transaction size', impact: 'negative', severity: 'medium' },
      { id: '3', description: 'Limited transaction history available', impact: 'negative', severity: 'low' }
    );
  } else {
    factors.push(
      { id: '1', description: 'Multiple missed or late payments', impact: 'negative', severity: 'high' },
      { id: '2', description: 'High number of transactions with insufficient funds', impact: 'negative', severity: 'high' },
      { id: '3', description: 'Account recently created with minimal history', impact: 'negative', severity: 'medium' },
      { id: '4', description: 'Unusual spending pattern detected', impact: 'negative', severity: 'medium' }
    );
  }

  return factors;
};

const generateMockHistory = (currentScore: number): CreditScoreHistory[] => {
  const history: CreditScoreHistory[] = [];
  const days = 30;

  for (let i = days; i >= 0; i--) {
    const variance = Math.floor(Math.random() * 10) - 5;
    const score = Math.max(0, Math.min(100, currentScore + variance - (i / 2)));
    history.push({
      score: Math.round(score),
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }

  return history;
};

const generateMockData = (): CreditScoreData => {
  const currentScore = Math.floor(Math.random() * 100);
  const previousScore = Math.floor(Math.random() * 100);

  return {
    currentScore,
    previousScore,
    history: generateMockHistory(currentScore),
    riskFactors: generateMockRiskFactors(currentScore),
    lastUpdated: new Date(),
    accountId: 'mock-account-123',
    userId: 'mock-user-456'
  };
};

export const useCreditScore = (options: UseCreditScoreOptions = {}): UseCreditScoreResult => {
  const { accountId, userId, mockData = true } = options;
  const [data, setData] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditScore = async () => {
    setLoading(true);
    setError(null);

    try {
      if (mockData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setData(generateMockData());
      } else {
        const endpoint = accountId
          ? `/api/accounts/${accountId}/credit-score`
          : userId
            ? `/api/users/${userId}/credit-score`
            : '/api/credit-score';

        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch credit score: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditScore();
  }, [accountId, userId, mockData]);

  return {
    data,
    loading,
    error,
    refetch: fetchCreditScore
  };
};

export default useCreditScore;
