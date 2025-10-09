// Core types for real-time fraud detection

export type RiskCategory = 'low' | 'medium' | 'high';

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency?: string;
  timestamp: number; // epoch ms
  merchantId?: string;
  merchantCategory?: string;
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
  deviceId?: string;
  channel?: 'pos' | 'online' | 'atm' | 'transfer';
  ipAddress?: string;
  previousBalance?: number;
}

export interface FeatureVector {
  id: string;
  accountId: string;
  features: number[];
  featureNames: string[];
}

export interface FeatureExtractorOptions {
  velocityWindowsMinutes?: number[]; // e.g., [1, 5, 60]
  maxHistoryPerAccount?: number; // rolling history size
}

export interface AnomalyScore {
  score: number; // 0..1
  model: 'isolation_forest' | 'one_class_svm';
  details?: Record<string, any>;
}

export interface PatternFinding {
  name: string;
  score: number; // 0..1
  reason: string;
}

export interface RiskResult {
  transactionId: string;
  riskScore: number; // 0..100
  category: RiskCategory;
  reasons: string[];
  components: {
    anomalyScores: AnomalyScore[];
    patternFindings: PatternFinding[];
  };
  latencyMs: number;
  timestamp: number;
}

export interface FeedbackEvent {
  transactionId: string;
  isFraud: boolean;
  category?: string;
  notes?: string;
  timestamp: number;
}

export interface MonitorStats {
  totalScored: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  falsePositiveRate?: number;
  truePositiveRate?: number;
  lastUpdated: number;
}

export interface AnomalyModel {
  fit(samples: FeatureVector[]): void;
  score(sample: FeatureVector): AnomalyScore;
  fitPartial?(samples: FeatureVector[]): void;
}