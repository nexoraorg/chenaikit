// Core types for real-time fraud detection

export interface RawTransaction {
  id: string;
  accountId: string;
  amount: number; // positive for credit, negative for debit
  currency?: string;
  timestamp: Date;
  merchant?: string;
  category?: string;
  location?: { lat?: number; lon?: number; country?: string; city?: string };
  channel?: 'pos' | 'online' | 'atm' | 'transfer';
  metadata?: Record<string, any>;
}

export interface TransactionFeatures {
  // Monetary features
  absAmount: number;
  isDebit: boolean;
  amountZScore?: number;
  amountRollingMean?: number;
  amountRollingStd?: number;

  // Time features
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  timeSinceLastTxnSec?: number;

  // Location / device features
  hasGeo: boolean;
  geoDistanceKm?: number;
  countryChanged?: boolean;
  cityChanged?: boolean;
  channel: RawTransaction['channel'];

  // Merchant/category features
  merchantKnown: boolean;
  categoryKnown: boolean;
  merchantTxnCount?: number;
  categoryTxnCount?: number;

  // Velocity features
  rollingTxnCount1h?: number;
  rollingTxnCount24h?: number;
  rollingAmount24h?: number;

  // Derived risk flags
  unusualHour?: boolean;
  unusualLocation?: boolean;
  unusualChannel?: boolean;
}

export interface AnomalyScores {
  isolationForest?: number; // 0-1 anomaly score
  oneClassSvm?: number; // 0-1 anomaly score (normalized)
  ensemble?: number; // combined anomaly score
}

export type FraudPattern =
  | 'rapid_small_txns'
  | 'new_geo_large_amount'
  | 'card_absent_high_value'
  | 'merchant_spike'
  | 'account_takeover'
  | 'cash_out_burst'
  | 'none';

export interface PatternMatch {
  pattern: FraudPattern;
  confidence: number; // 0-1
  indicators: string[]; // human-readable factors
}

export type RiskCategory = 'low' | 'medium' | 'high' | 'critical';

export interface RiskScore {
  score: number; // 0-100
  category: RiskCategory;
  reasons: string[];
}

export interface FraudDetectionResult {
  isFraud: boolean;
  risk: RiskScore;
  anomaly: AnomalyScores;
  patterns: PatternMatch[];
  features: TransactionFeatures;
  latencyMs: number;
  timestamp: Date;
}

export interface FeedbackEvent {
  transactionId: string;
  isFraudConfirmed: boolean; // true if confirmed fraud, false if false-positive
  notes?: string;
  createdAt: Date;
}

export interface FeatureExtractorOptions {
  rollingWindowSizes?: { meanStd?: number; velocity1h?: number; velocity24h?: number };
  unusualHourRange?: { start: number; end: number }[]; // e.g., [{start:0,end:5}]
  geoDistanceThresholdKm?: number; // flag unusual if over this threshold
}

export interface AnomalyDetectorOptions {
  weightIF?: number; // isolation forest weight in ensemble
  weightSVM?: number; // one-class SVM weight in ensemble
  calibration?: 'strict' | 'balanced' | 'lenient';
}

export interface RiskScorerOptions {
  thresholds?: { low: number; medium: number; high: number; critical: number };
  patternBoosts?: Partial<Record<FraudPattern, number>>; // add to risk score when pattern matches
}

export interface RealTimeScoringOptions {
  timeoutMs?: number; // end-to-end SLA
}