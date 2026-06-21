export interface CreditScore {
  score: number;
  createdAt: Date;
  reason?: string;
}

export interface CreditScoreHistory {
  score: number;
  timestamp: Date;
}

export interface RiskFactor {
  id: string;
  description: string;
  impact: 'positive' | 'negative';
  severity: 'low' | 'medium' | 'high';
}

export interface CreditScoreData {
  currentScore: number;
  previousScore?: number;
  history: CreditScoreHistory[];
  riskFactors: RiskFactor[];
  lastUpdated: Date;
  accountId?: string;
  userId?: string;
}

export interface CreditScoreCardProps {
  score: number;
  previousScore?: number;
  lastUpdated: Date;
  loading?: boolean;
  error?: string;
}

export interface ScoreHistoryChartProps {
  data: CreditScoreHistory[];
  loading?: boolean;
  error?: string;
  height?: number;
}

export interface RiskFactorsListProps {
  factors: RiskFactor[];
  loading?: boolean;
  error?: string;
  maxItems?: number;
}

export type ScoreRating = 'poor' | 'fair' | 'good' | 'excellent';

export interface ScoreThreshold {
  min: number;
  max: number;
  rating: ScoreRating;
  color: string;
  label: string;
}

export const SCORE_THRESHOLDS: ScoreThreshold[] = [
  { min: 0, max: 39, rating: 'poor', color: '#f44336', label: 'Poor' },
  { min: 40, max: 69, rating: 'fair', color: '#ff9800', label: 'Fair' },
  { min: 70, max: 84, rating: 'good', color: '#4caf50', label: 'Good' },
  { min: 85, max: 100, rating: 'excellent', color: '#2196f3', label: 'Excellent' }
];

export function getScoreRating(score: number): ScoreThreshold {
  return SCORE_THRESHOLDS.find(
    threshold => score >= threshold.min && score <= threshold.max
  ) || SCORE_THRESHOLDS[0];
}
