import { webhookService } from '../services/webhookService';
import { WebhookEventType } from '../models/Webhook';

/**
 * Trigger webhook events for various system events
 */
export const triggerWebhookEvent = async (
  eventType: WebhookEventType,
  data: any
) => {
  try {
    await webhookService.triggerWebhook(eventType, data);
  } catch (error) {
    console.error(`Failed to trigger webhook event ${eventType}:`, error);
    // Don't throw - webhook failures shouldn't break the main flow
  }
};

/**
 * User events
 */
export const triggerUserCreated = async (user: any) => {
  await triggerWebhookEvent('user.created', {
    userId: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  });
};

export const triggerUserUpdated = async (user: any) => {
  await triggerWebhookEvent('user.updated', {
    userId: user.id,
    email: user.email,
    role: user.role,
    updatedAt: user.updatedAt,
  });
};

/**
 * API Key events
 */
export const triggerApiKeyCreated = async (apiKey: any) => {
  await triggerWebhookEvent('api_key.created', {
    apiKeyId: apiKey.id,
    name: apiKey.name,
    tier: apiKey.tier,
    userId: apiKey.userId,
    createdAt: apiKey.createdAt,
  });
};

export const triggerApiKeyUpdated = async (apiKey: any) => {
  await triggerWebhookEvent('api_key.updated', {
    apiKeyId: apiKey.id,
    name: apiKey.name,
    tier: apiKey.tier,
    isActive: apiKey.isActive,
    updatedAt: apiKey.updatedAt,
  });
};

export const triggerApiKeyDeleted = async (apiKey: any) => {
  await triggerWebhookEvent('api_key.deleted', {
    apiKeyId: apiKey.id,
    name: apiKey.name,
    deletedAt: new Date().toISOString(),
  });
};

/**
 * Account events
 */
export const triggerAccountCreated = async (account: any) => {
  await triggerWebhookEvent('account.created', {
    accountId: account.id,
    stellarAddress: account.stellarAddress,
    nickname: account.nickname,
    userId: account.userId,
    createdAt: account.createdAt,
  });
};

export const triggerAccountUpdated = async (account: any) => {
  await triggerWebhookEvent('account.updated', {
    accountId: account.id,
    stellarAddress: account.stellarAddress,
    nickname: account.nickname,
    updatedAt: account.updatedAt,
  });
};

/**
 * Transaction events
 */
export const triggerTransactionCreated = async (transaction: any) => {
  await triggerWebhookEvent('transaction.created', {
    transactionId: transaction.id,
    accountId: transaction.accountId,
    amount: transaction.amount,
    type: transaction.type,
    status: transaction.status,
    createdAt: transaction.createdAt,
  });
};

export const triggerTransactionUpdated = async (transaction: any) => {
  await triggerWebhookEvent('transaction.updated', {
    transactionId: transaction.id,
    accountId: transaction.accountId,
    amount: transaction.amount,
    status: transaction.status,
    updatedAt: transaction.updatedAt,
  });
};

/**
 * Score events
 */
export const triggerScoreUpdated = async (score: any) => {
  await triggerWebhookEvent('score.updated', {
    scoreId: score.id,
    accountId: score.accountId,
    score: score.score,
    factors: score.factors,
    updatedAt: score.updatedAt,
  });
};

/**
 * Fraud events
 */
export const triggerFraudDetected = async (fraudAlert: any) => {
  await triggerWebhookEvent('fraud.detected', {
    alertId: fraudAlert.id,
    accountId: fraudAlert.accountId,
    riskScore: fraudAlert.riskScore,
    riskLevel: fraudAlert.riskLevel,
    factors: fraudAlert.factors,
    detectedAt: fraudAlert.createdAt,
  });
};
