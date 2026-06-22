import { ApiKey as PrismaApiKey, ApiUsage as PrismaApiUsage } from '@prisma/client';

export type ApiTier = 'FREE' | 'PRO' | 'ENTERPRISE';
export type ApiKeyType = 'READ_ONLY' | 'READ_WRITE' | 'ADMIN' | 'SCOPED' | 'TEMPORARY';
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'INACTIVE';

export interface ApiKeyCreateInput {
  name: string;
  tier?: ApiTier;
  type?: ApiKeyType;
  userId?: string;
  allowedIps?: string[];
  allowedPaths?: string[];
  expiresAt?: Date;
  usageQuota?: number;
  permissions?: string[];
  scopes?: string[];
}

export interface ApiKeyUpdateInput {
  name?: string;
  tier?: ApiTier;
  type?: ApiKeyType;
  status?: ApiKeyStatus;
  isActive?: boolean;
  allowedIps?: string[];
  allowedPaths?: string[];
  expiresAt?: Date;
  usageQuota?: number;
  permissions?: string[];
  scopes?: string[];
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
    public publicId: string,
    public keyHash: string,
    public name: string,
    public prefix: string,
    public type: ApiKeyType,
    public status: ApiKeyStatus,
    public permissions: string[],
    public scopes: string[],
    public tier: ApiTier,
    public userId: string | null,
    public isActive: boolean,
    public allowedIps: string[],
    public allowedPaths: string[],
    public createdAt: Date,
    public updatedAt: Date,
    public expiresAt: Date | null,
    public lastUsedAt: Date | null,
    public usageQuota: number | null,
    public usageCount: number,
    public successCount: number,
    public failureCount: number,
    public rotatedFrom: string | null,
    public usageResetAt: Date
  ) {}

  static fromPrisma(prismaApiKey: PrismaApiKey): ApiKey {
    return new ApiKey(
      prismaApiKey.id,
      prismaApiKey.publicId,
      prismaApiKey.keyHash,
      prismaApiKey.name,
      prismaApiKey.prefix,
      prismaApiKey.type as ApiKeyType,
      prismaApiKey.status as ApiKeyStatus,
      JSON.parse(prismaApiKey.permissions || '[]'),
      JSON.parse(prismaApiKey.scopes || '[]'),
      prismaApiKey.tier as ApiTier,
      prismaApiKey.userId,
      prismaApiKey.isActive,
      JSON.parse(prismaApiKey.allowedIps || '[]'),
      JSON.parse(prismaApiKey.allowedPaths || '[]'),
      prismaApiKey.createdAt,
      prismaApiKey.updatedAt,
      prismaApiKey.expiresAt,
      prismaApiKey.lastUsedAt,
      prismaApiKey.usageQuota,
      prismaApiKey.usageCount,
      prismaApiKey.successCount,
      prismaApiKey.failureCount,
      prismaApiKey.rotatedFrom,
      prismaApiKey.usageResetAt
    );
  }

  isExpired(): boolean {
    if (this.status === 'EXPIRED') return true;
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }

  isRevoked(): boolean {
    return this.status === 'REVOKED';
  }

  isActiveStatus(): boolean {
    return this.status === 'ACTIVE' && this.isActive;
  }

  isIpAllowed(ip: string): boolean {
    if (this.allowedIps.length === 0) return true;
    return this.allowedIps.includes(ip);
  }

  isPathAllowed(path: string): boolean {
    if (this.allowedPaths.length === 0) return true;
    
    // Security: Limit path complexity to prevent ReDoS
    if (path.length > 512) return false;

    return this.allowedPaths.some(pattern => {
      // Security: Prevent extremely long patterns or too many wildcards
      if (!pattern || pattern.length > 128) return false;
      
      // Manual safe matching for common patterns (e.g., /api/v1/*)
      // This is much safer than dynamic RegExp construction
      if (pattern.endsWith('*')) {
        const base = pattern.slice(0, -1);
        return path.startsWith(base);
      }
      
      return path === pattern;
    });
  }

  hasScope(scope: string): boolean {
    if (this.type === 'ADMIN') return true;
    if (this.scopes.length === 0) return true;
    return this.scopes.includes(scope);
  }

  hasPermission(permission: string): boolean {
    if (this.type === 'ADMIN') return true;
    if (this.permissions.length === 0) return true;
    return this.permissions.includes(permission);
  }

  hasQuotaExceeded(): boolean {
    if (!this.usageQuota) return false;
    
    const now = new Date();
    const resetDate = new Date(this.usageResetAt);
    
    // Reset monthly quota if needed
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      return false;
    }
    
    return this.usageCount >= this.usageQuota;
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
