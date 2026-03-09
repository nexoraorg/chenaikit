import { ApiKey as PrismaApiKey, ApiUsage as PrismaApiUsage } from '../generated/prisma';

export type ApiTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface ApiKeyCreateInput {
  name: string;
  tier?: ApiTier;
  userId?: string;
  allowedIps?: string[];
  allowedPaths?: string[];
  expiresAt?: Date;
  usageQuota?: number;
}

export interface ApiKeyUpdateInput {
  name?: string;
  tier?: ApiTier;
  isActive?: boolean;
  allowedIps?: string[];
  allowedPaths?: string[];
  expiresAt?: Date;
  usageQuota?: number;
}

export interface ApiKeyUsage {
  totalRequests: number;
  requestsThisMonth: number;
  averageResponseTime: number;
  successRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
  }>;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ApiTierConfig {
  FREE: {
    rateLimit: RateLimitConfig;
    quota: number;
    features: string[];
  };
  PRO: {
    rateLimit: RateLimitConfig;
    quota: number;
    features: string[];
  };
  ENTERPRISE: {
    rateLimit: RateLimitConfig;
    quota: number;
    features: string[];
  };
}

export class ApiKey {
  constructor(
    public id: string,
    public keyHash: string,
    public name: string,
    public tier: ApiTier,
    public userId: string | null,
    public isActive: boolean,
    public allowedIps: string[],
    public allowedPaths: string[],
    public createdAt: Date,
    public expiresAt: Date | null,
    public lastUsedAt: Date,
    public usageQuota: number | null,
    public currentUsage: number,
    public usageResetAt: Date
  ) {}

  static fromPrisma(prismaApiKey: PrismaApiKey): ApiKey {
    return new ApiKey(
      prismaApiKey.id,
      prismaApiKey.keyHash,
      prismaApiKey.name,
      prismaApiKey.tier as ApiTier,
      prismaApiKey.userId,
      prismaApiKey.isActive,
      JSON.parse(prismaApiKey.allowedIps || '[]'),
      JSON.parse(prismaApiKey.allowedPaths || '[]'),
      prismaApiKey.createdAt,
      prismaApiKey.expiresAt,
      prismaApiKey.lastUsedAt,
      prismaApiKey.usageQuota,
      prismaApiKey.currentUsage,
      prismaApiKey.usageResetAt
    );
  }

  isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }

  isIpAllowed(ip: string): boolean {
    if (this.allowedIps.length === 0) return true;
    return this.allowedIps.includes(ip);
  }

  isPathAllowed(path: string): boolean {
    if (this.allowedPaths.length === 0) return true;
    return this.allowedPaths.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    });
  }

  hasQuotaExceeded(): boolean {
    if (!this.usageQuota) return false;
    
    const now = new Date();
    const resetDate = new Date(this.usageResetAt);
    
    // Reset monthly quota if needed
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      return false;
    }
    
    return this.currentUsage >= this.usageQuota;
  }

  needsQuotaReset(): boolean {
    const now = new Date();
    const resetDate = new Date(this.usageResetAt);
    
    return now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();
  }
}

export class ApiUsage {
  constructor(
    public id: string,
    public apiKeyId: string,
    public endpoint: string,
    public method: string,
    public statusCode: number,
    public responseTime: number,
    public requestSize: number,
    public responseSize: number,
    public ip: string,
    public userAgent: string | null,
    public timestamp: Date
  ) {}

  static fromPrisma(prismaApiUsage: PrismaApiUsage): ApiUsage {
    return new ApiUsage(
      prismaApiUsage.id,
      prismaApiUsage.apiKeyId,
      prismaApiUsage.endpoint,
      prismaApiUsage.method,
      prismaApiUsage.statusCode,
      prismaApiUsage.responseTime,
      prismaApiUsage.requestSize,
      prismaApiUsage.responseSize,
      prismaApiUsage.ip,
      prismaApiUsage.userAgent,
      prismaApiUsage.timestamp
    );
  }
}

export const API_TIER_CONFIGS: ApiTierConfig = {
  FREE: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    },
    quota: 1000, // 1000 requests per month
    features: ['basic_access', 'rate_limiting']
  },
  PRO: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
    },
    quota: 100000, // 100k requests per month
    features: ['basic_access', 'rate_limiting', 'analytics', 'priority_support']
  },
  ENTERPRISE: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000,
    },
    quota: 10000000, // 10M requests per month
    features: ['basic_access', 'rate_limiting', 'analytics', 'priority_support', 'custom_integrations', 'dedicated_support']
  }
};
