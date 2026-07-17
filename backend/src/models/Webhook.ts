export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  headers: Record<string, string>;
  retryCount: number;
  timeout: number;
  allowedIps: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  statusCode?: number;
  response?: string;
  attempt: number;
  success: boolean;
  error?: string;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEventType = 
  | 'transaction.created'
  | 'transaction.updated'
  | 'account.created'
  | 'account.updated'
  | 'score.updated'
  | 'fraud.detected'
  | 'user.created'
  | 'user.updated'
  | 'api_key.created'
  | 'api_key.updated'
  | 'api_key.deleted'
  | 'test';

export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: string;
  data: any;
  webhookId: string;
}
