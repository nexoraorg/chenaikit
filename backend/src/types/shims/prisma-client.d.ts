/**
 * Type shim for @prisma/client
 *
 * Generated from prisma/schema.prisma.
 * Replace this file by running `prisma generate` once Prisma is compatible
 * with the installed Node.js version.
 */

// ─── Scalar / helper types ────────────────────────────────────────────────────

type InputJsonValue = string | number | boolean | null | { [key: string]: InputJsonValue } | InputJsonValue[];

// ─── Prisma namespace (error classes, etc.) ───────────────────────────────────

export namespace Prisma {
  export class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(message: string, opts: { code: string; clientVersion: string; meta?: Record<string, unknown> });
  }
  export class PrismaClientUnknownRequestError extends Error {}
  export class PrismaClientInitializationError extends Error {}
  export class PrismaClientRustPanicError extends Error {}
  export class PrismaClientValidationError extends Error {}
}

// ─── Model types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RefreshToken {
  id: number;
  tokenHash: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  /** Populated when using `include: { user: true }` */
  user?: User;
}

export interface ApiKey {
  id: string;
  keyHash: string;
  name: string;
  tier: string;
  userId: string | null;
  isActive: boolean;
  allowedIps: string;
  allowedPaths: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date;
  usageQuota: number | null;
  currentUsage: number;
  usageResetAt: Date;
  deletedAt: Date | null;
}

export interface ApiUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  ip: string;
  userAgent: string | null;
  timestamp: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  secret: string;
  secretHash: string;
  events: string;
  isActive: boolean;
  isPaused: boolean;
  allowedIps: string;
  headers: string;
  maxRetries: number;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lastTriggeredAt: Date | null;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: string;
  statusCode: number | null;
  responseBody: string | null;
  responseHeaders: string | null;
  attempt: number;
  maxAttempts: number;
  status: string;
  errorMessage: string | null;
  duration: number | null;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Delegate types (simplified) ─────────────────────────────────────────────

interface FindManyArgs<T> {
  where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>;
  select?: Partial<Record<keyof T, boolean>> & Record<string, unknown>;
  include?: Record<string, boolean | Record<string, unknown>>;
  orderBy?: Partial<Record<keyof T, 'asc' | 'desc'>> | Array<Partial<Record<keyof T, 'asc' | 'desc'>>>;
  skip?: number;
  take?: number;
  distinct?: Array<keyof T>;
  cursor?: Partial<Record<keyof T, unknown>>;
}

interface FindFirstArgs<T> extends FindManyArgs<T> {}
interface FindUniqueArgs<T> { where: Partial<Record<keyof T, unknown>> & Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown>; }
interface CreateArgs<T> { data: Partial<T> & Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown>; }
interface UpdateArgs<T> { where: Partial<Record<keyof T, unknown>> & Record<string, unknown>; data: Partial<T> & Record<string, unknown | IntFieldUpdateOperationsInput>; select?: Record<string, unknown>; }
interface UpdateManyArgs<T> { where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>; data: Partial<T> & Record<string, unknown>; }
interface DeleteManyArgs<T> { where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>; }
interface AggregateArgs<T> { where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>; _avg?: Partial<Record<keyof T, boolean>>; _sum?: Partial<Record<keyof T, boolean>>; _count?: boolean | Partial<Record<keyof T, boolean>>; _min?: Partial<Record<keyof T, boolean>>; _max?: Partial<Record<keyof T, boolean>>; }
interface GroupByArgs<T> { by: Array<keyof T>; where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>; _count?: boolean | Partial<Record<keyof T, boolean>>; _avg?: Partial<Record<keyof T, boolean>>; orderBy?: Record<string, unknown>; take?: number; having?: Record<string, unknown>; }
interface CountArgs<T> { where?: Partial<Record<keyof T, unknown>> & Record<string, unknown>; select?: Record<string, unknown>; }

interface BatchPayload { count: number; }
interface AggregateResult<T> {
  _avg: Partial<Record<keyof T, number | null>>;
  _sum: Partial<Record<keyof T, number | null>>;
  _count: number;
  _min: Partial<Record<keyof T, unknown>>;
  _max: Partial<Record<keyof T, unknown>>;
}

/** Prisma atomic number operations (increment, decrement, etc.) */
interface IntFieldUpdateOperationsInput {
  set?: number;
  increment?: number;
  decrement?: number;
  multiply?: number;
  divide?: number;
}

interface Delegate<T> {
  findMany(args?: FindManyArgs<T>): Promise<T[]>;
  findFirst(args?: FindFirstArgs<T>): Promise<T | null>;
  findUnique(args: FindUniqueArgs<T>): Promise<T | null>;
  create(args: CreateArgs<T>): Promise<T>;
  update(args: UpdateArgs<T>): Promise<T>;
  updateMany(args: UpdateManyArgs<T>): Promise<BatchPayload>;
  delete(args: FindUniqueArgs<T>): Promise<T>;
  deleteMany(args?: DeleteManyArgs<T>): Promise<BatchPayload>;
  count(args?: CountArgs<T>): Promise<number>;
  aggregate(args: AggregateArgs<T>): Promise<AggregateResult<T>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupBy(args: GroupByArgs<T>): Promise<any[]>;
}

// WebhookDelivery delegate with include support
interface WebhookDeliveryWithWebhook extends WebhookDelivery {
  webhook: Webhook;
}

interface WebhookDeliveryDelegate extends Delegate<WebhookDelivery> {
  findUnique(args: FindUniqueArgs<WebhookDelivery> & { include?: { webhook?: boolean } }): Promise<WebhookDeliveryWithWebhook | null>;
  fields?: Record<string, unknown>;
}

// ─── PrismaClient ─────────────────────────────────────────────────────────────

export declare class PrismaClient {
  constructor(opts?: { datasources?: { db?: { url?: string } }; log?: unknown[] });

  readonly user: Delegate<User>;
  readonly refreshToken: Delegate<RefreshToken>;
  readonly apiKey: Delegate<ApiKey>;
  readonly apiUsage: Delegate<ApiUsage>;
  readonly webhook: Delegate<Webhook>;
  readonly webhookDelivery: WebhookDeliveryDelegate;

  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
  $on(event: string, cb: (e: unknown) => void): void;
}
