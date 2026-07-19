import { Prisma } from '@prisma/client';
import { WebhookEventType } from '../utils/webhookUtils';

export interface WebhookCreateInput {
  userId: string;
  url: string;
  secret: string;
  eventTypes: WebhookEventType[];
  allowedIps?: string[];
  headers?: Record<string, string>;
  retryConfig?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  };
}

export interface WebhookUpdateInput {
  url?: string;
  secret?: string;
  eventTypes?: WebhookEventType[];
  isActive?: boolean;
  isPaused?: boolean;
  allowedIps?: string[];
  headers?: Record<string, string>;
  retryConfig?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  };
}

export class Webhook {
  id!: string;
  userId!: string;
  url!: string;
  secret!: string;
  eventTypes!: WebhookEventType[];
  isActive!: boolean;
  isPaused!: boolean;
  allowedIps!: string[];
  headers!: Record<string, string>;
  retryConfig!: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  static fromPrisma(prismaWebhook: Prisma.WebhookGetPayload<{}>): Webhook {
    const webhook = new Webhook();
    webhook.id = prismaWebhook.id;
    webhook.userId = prismaWebhook.userId;
    webhook.url = prismaWebhook.url;
    webhook.secret = prismaWebhook.secret;
    webhook.eventTypes = JSON.parse(prismaWebhook.eventTypes) as WebhookEventType[];
    webhook.isActive = prismaWebhook.isActive;
    webhook.isPaused = prismaWebhook.isPaused;
    webhook.allowedIps = JSON.parse(prismaWebhook.allowedIps || '[]') as string[];
    webhook.headers = JSON.parse(prismaWebhook.headers || '{}') as Record<string, string>;
    webhook.retryConfig = JSON.parse(prismaWebhook.retryConfig || '{}') as {
      maxAttempts: number;
      initialDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    };
    webhook.createdAt = prismaWebhook.createdAt;
    webhook.updatedAt = prismaWebhook.updatedAt;
    webhook.deletedAt = prismaWebhook.deletedAt || undefined;
    return webhook;
  }

  toPrismaCreate(): Prisma.WebhookCreateInput {
    return {
      user: {
        connect: { id: this.userId },
      },
      url: this.url,
      secret: this.secret,
      eventTypes: JSON.stringify(this.eventTypes),
      isActive: this.isActive,
      isPaused: this.isPaused,
      allowedIps: JSON.stringify(this.allowedIps),
      headers: JSON.stringify(this.headers),
      retryConfig: JSON.stringify(this.retryConfig),
    };
  }

  toPrismaUpdate(): Prisma.WebhookUpdateInput {
    return {
      ...(this.url !== undefined && { url: this.url }),
      ...(this.secret !== undefined && { secret: this.secret }),
      ...(this.eventTypes !== undefined && { eventTypes: JSON.stringify(this.eventTypes) }),
      ...(this.isActive !== undefined && { isActive: this.isActive }),
      ...(this.isPaused !== undefined && { isPaused: this.isPaused }),
      ...(this.allowedIps !== undefined && { allowedIps: JSON.stringify(this.allowedIps) }),
      ...(this.headers !== undefined && { headers: JSON.stringify(this.headers) }),
      ...(this.retryConfig !== undefined && { retryConfig: JSON.stringify(this.retryConfig) }),
    };
  }

  isEligibleForEvent(eventType: WebhookEventType): boolean {
    return this.isActive && !this.isPaused && this.eventTypes.includes(eventType);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      url: this.url,
      eventTypes: this.eventTypes,
      isActive: this.isActive,
      isPaused: this.isPaused,
      allowedIps: this.allowedIps,
      headers: this.headers,
      retryConfig: this.retryConfig,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

export class WebhookDelivery {
  id!: string;
  webhookId!: string;
  eventType!: string;
  payload!: string;
  responseStatus?: number;
  responseBody?: string;
  attemptCount!: number;
  nextRetryAt?: Date;
  succeededAt?: Date;
  failedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;

  static fromPrisma(prismaDelivery: Prisma.WebhookDeliveryGetPayload<{}>): WebhookDelivery {
    const delivery = new WebhookDelivery();
    delivery.id = prismaDelivery.id;
    delivery.webhookId = prismaDelivery.webhookId;
    delivery.eventType = prismaDelivery.eventType;
    delivery.payload = prismaDelivery.payload;
    delivery.responseStatus = prismaDelivery.responseStatus || undefined;
    delivery.responseBody = prismaDelivery.responseBody || undefined;
    delivery.attemptCount = prismaDelivery.attemptCount;
    delivery.nextRetryAt = prismaDelivery.nextRetryAt || undefined;
    delivery.succeededAt = prismaDelivery.succeededAt || undefined;
    delivery.failedAt = prismaDelivery.failedAt || undefined;
    delivery.createdAt = prismaDelivery.createdAt;
    delivery.updatedAt = prismaDelivery.updatedAt;
    delivery.deletedAt = prismaDelivery.deletedAt || undefined;
    return delivery;
  }

  isSuccessful(): boolean {
    return this.responseStatus !== undefined && this.responseStatus >= 200 && this.responseStatus < 300;
  }

  shouldRetry(): boolean {
    if (this.succeededAt) return false;
    if (this.failedAt && this.attemptCount >= 5) return false;
    return this.nextRetryAt !== undefined && this.nextRetryAt > new Date();
  }

  toJSON() {
    return {
      id: this.id,
      webhookId: this.webhookId,
      eventType: this.eventType,
      payload: this.payload,
      responseStatus: this.responseStatus,
      responseBody: this.responseBody,
      attemptCount: this.attemptCount,
      nextRetryAt: this.nextRetryAt,
      succeededAt: this.succeededAt,
      failedAt: this.failedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
