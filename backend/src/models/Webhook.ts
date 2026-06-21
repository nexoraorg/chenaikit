import type {
  Webhook as PrismaWebhook,
  WebhookDelivery as PrismaWebhookDelivery,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Event type catalogue
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENT_TYPES = [
  // Transaction events
  'transaction.created',
  'transaction.updated',
  'transaction.completed',
  'transaction.failed',
  'transaction.reversed',

  // Account events
  'account.created',
  'account.updated',
  'account.deleted',
  'account.suspended',
  'account.reactivated',

  // Score events
  'credit_score.calculated',
  'credit_score.updated',
  'credit_score.threshold_crossed',

  // Fraud events
  'fraud.alert_created',
  'fraud.alert_resolved',
  'fraud.suspicious_activity',

  // System events
  'system.webhook_test',
  'system.rate_limit_warning',
  'system.quota_warning',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

export interface WebhookCreateInput {
  userId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  allowedIps?: string[];
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface WebhookUpdateInput {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
  isPaused?: boolean;
  allowedIps?: string[];
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface WebhookEventPayload {
  id: string;                      // Unique event ID (idempotency key)
  type: WebhookEventType;
  timestamp: string;               // ISO 8601
  version: string;                 // Payload schema version
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  deliveryId: string;
  webhookId: string;
  eventType: WebhookEventType;
  statusCode?: number;
  duration?: number;
  attempt: number;
  status: WebhookDeliveryStatus;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Domain model classes
// ---------------------------------------------------------------------------

export class Webhook {
  constructor(
    public id: string,
    public userId: string,
    public name: string,
    public url: string,
    public secret: string,
    public secretHash: string,
    public events: WebhookEventType[],
    public isActive: boolean,
    public isPaused: boolean,
    public allowedIps: string[],
    public headers: Record<string, string>,
    public maxRetries: number,
    public timeoutMs: number,
    public createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
    public lastTriggeredAt: Date | null
  ) {}

  static fromPrisma(w: PrismaWebhook): Webhook {
    return new Webhook(
      w.id,
      w.userId,
      w.name,
      w.url,
      w.secret,
      w.secretHash,
      JSON.parse(w.events || '[]') as WebhookEventType[],
      w.isActive,
      w.isPaused,
      JSON.parse(w.allowedIps || '[]') as string[],
      JSON.parse(w.headers || '{}') as Record<string, string>,
      w.maxRetries,
      w.timeoutMs,
      w.createdAt,
      w.updatedAt,
      w.deletedAt,
      w.lastTriggeredAt
    );
  }

  /** Returns a safe public representation (omits the raw secret). */
  toPublic(): {
    id: string;
    userId: string;
    name: string;
    url: string;
    events: WebhookEventType[];
    isActive: boolean;
    isPaused: boolean;
    allowedIps: string[];
    headers: Record<string, string>;
    maxRetries: number;
    timeoutMs: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    lastTriggeredAt: Date | null;
  } {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      url: this.url,
      events: this.events,
      isActive: this.isActive,
      isPaused: this.isPaused,
      allowedIps: this.allowedIps,
      headers: this.headers,
      maxRetries: this.maxRetries,
      timeoutMs: this.timeoutMs,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      lastTriggeredAt: this.lastTriggeredAt,
    };
  }

  isSubscribedTo(event: WebhookEventType): boolean {
    return this.events.includes(event);
  }
}

export class WebhookDelivery {
  constructor(
    public id: string,
    public webhookId: string,
    public eventType: WebhookEventType,
    public eventId: string,
    public payload: WebhookEventPayload,
    public statusCode: number | null,
    public responseBody: string | null,
    public responseHeaders: Record<string, string> | null,
    public attempt: number,
    public maxAttempts: number,
    public status: WebhookDeliveryStatus,
    public errorMessage: string | null,
    public duration: number | null,
    public nextRetryAt: Date | null,
    public deliveredAt: Date | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static fromPrisma(d: PrismaWebhookDelivery): WebhookDelivery {
    return new WebhookDelivery(
      d.id,
      d.webhookId,
      d.eventType as WebhookEventType,
      d.eventId,
      JSON.parse(d.payload) as WebhookEventPayload,
      d.statusCode,
      d.responseBody,
      d.responseHeaders ? (JSON.parse(d.responseHeaders) as Record<string, string>) : null,
      d.attempt,
      d.maxAttempts,
      d.status as WebhookDeliveryStatus,
      d.errorMessage,
      d.duration,
      d.nextRetryAt,
      d.deliveredAt,
      d.createdAt,
      d.updatedAt
    );
  }

  isSuccess(): boolean {
    return this.status === 'success';
  }

  canRetry(): boolean {
    return this.status === 'failed' && this.attempt < this.maxAttempts;
  }
}
