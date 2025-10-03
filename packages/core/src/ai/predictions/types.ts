export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // e.g., 0.95 for 95% CI
}

export interface ForecastPoint {
  date: Date;
  value: number;
  ci?: ConfidenceInterval;
}

export interface ForecastMetrics {
  rmse: number;
  mae: number;
  mape: number;
  coverage?: number; // proportion of actuals within CI during validation
}

export interface ForecastResult {
  points: ForecastPoint[];
  metrics?: ForecastMetrics;
}

export interface SpendingTransaction {
  date: Date;
  amount: number;
  category?: string;
}

export interface SpendingPrediction {
  category: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  ci?: ConfidenceInterval;
}

export interface SpendingPredictionResult {
  predictions: SpendingPrediction[];
  metrics?: ForecastMetrics;
}

export interface TrendComponents {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalityStrength: number; // 0..1
  trendDirection: 'up' | 'down' | 'flat';
  seasonalPeriod?: number;
}

export interface TrendAnalysisResult {
  components: TrendComponents;
  insights: string[];
}

export interface FinancialHealth {
  savingsRate: number; // savings / income
  expenseVolatility: number; // std dev of expenses
  liquidityDays: number; // balance / daily spend
  debtToIncome?: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface EvaluationReport {
  metrics: ForecastMetrics;
  notes?: string[];
}

export interface ForecasterOptions {
  seasonalityPeriod?: number; // e.g., 7 (weekly), 12 (monthly)
  windowSize?: number; // moving average window for trend smoothing
  confidenceLevel?: number; // e.g., 0.95
  adaptivity?: number; // 0..1 for exponential smoothing strength
}

export interface BalanceSnapshot {
  date: Date;
  balance: number;
}

export interface CashFlow {
  date: Date;
  inflow: number; // positive
  outflow: number; // positive
}