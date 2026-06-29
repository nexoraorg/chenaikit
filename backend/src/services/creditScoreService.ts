/**
 * Credit scoring service with Prisma queries for v2 API.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreditScoreResult {
  score: number;
  confidence: number;
  factors: Array<{ name: string; weight: number | null }>;
  generatedAt: string;
  model: string;
}

export interface CreditScoreHistoryItem {
  id: string;
  score: number;
  reason?: string;
  createdAt: Date;
}

export interface ScoringModel {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

class CreditScoreService {
  /**
   * Calculate credit score for an account
   */
  async calculateScore(
    accountId: string,
    userId?: string,
    model: string = 'credit-score-v2',
    includeFactors: boolean = true
  ): Promise<CreditScoreResult> {
    // In a real implementation, this would call ML models
    // For now, we'll generate a deterministic score based on accountId
    const hash = this.hashAccountId(accountId);
    const baseScore = 300 + (hash % 550); // Range 300-850
    const confidence = 0.85 + (Math.random() * 0.14); // 0.85-0.99

    const factors = includeFactors
      ? [
          { name: 'payment_history', weight: 0.35 },
          { name: 'credit_utilization', weight: 0.30 },
          { name: 'account_age', weight: 0.15 },
          { name: 'credit_mix', weight: 0.10 },
          { name: 'new_credit', weight: 0.10 },
        ]
      : [];

    // Save to database using Prisma
    await prisma.creditScore.create({
      data: {
        score: baseScore,
        reason: `Calculated using ${model}`,
        userId: userId,
        accountId: accountId,
      },
    });

    return {
      score: baseScore,
      confidence,
      factors,
      generatedAt: new Date().toISOString(),
      model,
    };
  }

  /**
   * Get credit score history for an account
   */
  async getHistory(
    accountId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ items: CreditScoreHistoryItem[]; total: number }> {
    const [items, total] = await prisma.$transaction([
      prisma.creditScore.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.creditScore.count({ where: { accountId } }),
    ]);

    return {
      items: items.map((item: any) => ({
        id: item.id,
        score: item.score,
        reason: item.reason || undefined,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  /**
   * Get available scoring models
   */
  async getModels(): Promise<ScoringModel[]> {
    // In a real implementation, this would query a models table
    // For now, return static list
    return [
      {
        id: 'model-1',
        name: 'FICO-like',
        version: '2.0',
        description: 'Standard credit scoring model similar to FICO',
        enabled: true,
      },
      {
        id: 'model-2',
        name: 'VantageScore',
        version: '3.0',
        description: 'Alternative credit scoring model',
        enabled: true,
      },
      {
        id: 'model-3',
        name: 'ML-Enhanced',
        version: '1.0',
        description: 'Machine learning enhanced scoring model',
        enabled: false,
      },
    ];
  }

  /**
   * Simple hash function for deterministic score generation
   */
  private hashAccountId(accountId: string): number {
    let hash = 0;
    for (let i = 0; i < accountId.length; i++) {
      const char = accountId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const creditScoreService = new CreditScoreService();
