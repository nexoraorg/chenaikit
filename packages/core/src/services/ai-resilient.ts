import { CircuitBreaker } from '../utils/circuit-breaker';
import { retry, isRetryableError } from '../utils/retry';

export interface AIServiceConfig {
  apiKey: string;
  endpoint?: string;
  fallbackEnabled?: boolean;
}

export interface CreditScoreResult {
  score: number;
  confidence: number;
  source: 'ai' | 'fallback';
}

export class AIServiceWithResilience {
  private circuitBreaker: CircuitBreaker<any>;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = { fallbackEnabled: true, ...config };
    
    this.circuitBreaker = new CircuitBreaker(
      this.callAIService.bind(this),
      {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 30000,
        resetTimeout: 60000,
        onStateChange: (state) => console.log(`AI Service circuit breaker: ${state}`)
      }
    );
  }

  async calculateCreditScore(accountData: any): Promise<CreditScoreResult> {
    try {
      const result = await retry(
        () => this.circuitBreaker.execute('creditScore', accountData),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (error, attempt) => {
            if (isRetryableError(error)) {
              console.log(`Retrying AI service (attempt ${attempt}): ${error.message}`);
            }
          }
        }
      );

      return { ...result, source: 'ai' };
    } catch (error) {
      if (this.config.fallbackEnabled) {
        console.warn('AI service failed, using fallback', error);
        return this.fallbackCreditScore(accountData);
      }
      throw error;
    }
  }

  async detectFraud(transactionData: any): Promise<{ isFraud: boolean; confidence: number; source: 'ai' | 'fallback' }> {
    try {
      const result = await retry(
        () => this.circuitBreaker.execute('fraudDetection', transactionData),
        { maxAttempts: 2, initialDelay: 500 }
      );

      return { ...result, source: 'ai' };
    } catch (error) {
      if (this.config.fallbackEnabled) {
        console.warn('Fraud detection failed, using fallback', error);
        return this.fallbackFraudDetection(transactionData);
      }
      throw error;
    }
  }

  private async callAIService(operation: string, data: any): Promise<any> {
    const response = await fetch(`${this.config.endpoint}/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    return response.json();
  }

  private fallbackCreditScore(accountData: any): CreditScoreResult {
    const balance = accountData.balance || 0;
    const age = accountData.age || 0;
    const txCount = accountData.transactionCount || 0;

    const score = Math.min(850, Math.max(300, 
      500 + (balance / 10000) * 50 + (age / 365) * 100 + (txCount / 100) * 50
    ));

    return { score: Math.round(score), confidence: 0.6, source: 'fallback' };
  }

  private fallbackFraudDetection(transactionData: any): { isFraud: boolean; confidence: number; source: 'fallback' } {
    const amount = transactionData.amount || 0;
    const velocity = transactionData.velocity || 0;

    const isFraud = amount > 100000 || velocity > 10;

    return { isFraud, confidence: 0.5, source: 'fallback' };
  }
}
