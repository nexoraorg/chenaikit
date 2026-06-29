/**
 * Fraud detection service with Prisma queries for v2 API.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface FraudAnalysisResult {
  isFraud: boolean;
  riskScore: number;
  factors: Array<{ name: string; weight: number | null }>;
  generatedAt: string;
  model: string;
}

export interface FraudAlertItem {
  id: string;
  alertType: string;
  details?: string;
  resolved: boolean;
  createdAt: Date;
  transactionId?: string;
  accountId?: string;
}

export interface FraudAlertsResponse {
  items: FraudAlertItem[];
  total: number;
  limit: number;
  offset: number;
}

class FraudDetectionService {
  /**
   * Analyze a transaction for fraud
   */
  async analyzeTransaction(data: {
    transactionId?: string;
    accountId: string;
    amount: number;
    currency: string;
    merchant?: string;
    location?: { latitude: number; longitude: number };
    deviceId?: string;
    ip?: string;
    timestamp?: string;
  }): Promise<FraudAnalysisResult> {
    // In a real implementation, this would call ML models
    // For now, we'll generate a deterministic risk score based on transaction data
    const hash = this.hashTransactionData(data);
    const riskScore = hash % 100; // 0-99
    const isFraud = riskScore > 70; // Threshold at 70

    const factors = [
      { name: 'transaction_amount', weight: riskScore > 50 ? 0.3 : 0.1 },
      { name: 'location', weight: data.location ? 0.25 : 0 },
      { name: 'device', weight: data.deviceId ? 0.2 : 0 },
      { name: 'ip_reputation', weight: data.ip ? 0.15 : 0 },
      { name: 'merchant_risk', weight: data.merchant ? 0.1 : 0 },
    ].filter((f) => f.weight > 0);

    // If fraud detected, create an alert
    if (isFraud && data.transactionId) {
      await prisma.fraudAlert.create({
        data: {
          alertType: 'high_risk_transaction',
          details: `Risk score: ${riskScore}. Amount: ${data.amount} ${data.currency}`,
          resolved: false,
          transactionId: data.transactionId,
          accountId: data.accountId,
        },
      });
    }

    return {
      isFraud,
      riskScore,
      factors,
      generatedAt: new Date().toISOString(),
      model: 'fraud-detect-v2',
    };
  }

  /**
   * Get fraud alerts with pagination and filtering
   */
  async getAlerts(filters: {
    limit: number;
    offset: number;
    resolved?: boolean;
    alertType?: string;
  }): Promise<FraudAlertsResponse> {
    const where: any = {};
    if (filters.resolved !== undefined) {
      where.resolved = filters.resolved;
    }
    if (filters.alertType) {
      where.alertType = filters.alertType;
    }

    const [items, total] = await prisma.$transaction([
      prisma.fraudAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      prisma.fraudAlert.count({ where }),
    ]);

    return {
      items: items.map((item: any) => ({
        id: item.id,
        alertType: item.alertType,
        details: item.details || undefined,
        resolved: item.resolved,
        createdAt: item.createdAt,
        transactionId: item.transactionId || undefined,
        accountId: item.accountId || undefined,
      })),
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  /**
   * Acknowledge a fraud alert (mark as reviewed)
   */
  async acknowledgeAlert(alertId: string, notes?: string): Promise<FraudAlertItem> {
    const updated = await prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        details: notes ? `${(await prisma.fraudAlert.findUnique({ where: { id: alertId } }))?.details || ''}\n\nAcknowledged: ${notes}` : undefined,
      },
    });

    return {
      id: updated.id,
      alertType: updated.alertType,
      details: updated.details || undefined,
      resolved: updated.resolved,
      createdAt: updated.createdAt,
      transactionId: updated.transactionId || undefined,
      accountId: updated.accountId || undefined,
    };
  }

  /**
   * Simple hash function for deterministic risk score generation
   */
  private hashTransactionData(data: any): number {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const fraudDetectionService = new FraudDetectionService();
