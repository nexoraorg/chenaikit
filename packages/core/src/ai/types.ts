export interface AIConfig {
  apiKey: string;
  modelUrl?: string;
  timeout?: number;
}

export interface CreditScoreResult {
  score: number;
  factors: string[];
  confidence: number;
}
