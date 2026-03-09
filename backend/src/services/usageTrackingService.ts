import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

export class UsageTrackingService {
  constructor(private prisma: PrismaClient) {}

  async trackUsage(data: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    requestSize: number;
    responseSize: number;
    ip: string;
    userAgent?: string;
  }) {
    return this.prisma.apiUsage.create({
      data: {
        apiKeyId: data.apiKeyId,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        requestSize: data.requestSize,
        responseSize: data.responseSize,
        ip: data.ip,
        userAgent: data.userAgent,
      }
    });
  }

  // Alias for backward compatibility with apiGateway
  async recordUsage(data: any) {
    return this.trackUsage(data);
  }

  extractUsageFromRequest(
    req: Request,
    apiKeyId: string,
    responseTime: number,
    statusCode: number,
    responseSize: number
  ) {
    return {
      apiKeyId,
      endpoint: req.path,
      method: req.method,
      statusCode,
      responseTime,
      requestSize: parseInt(req.headers['content-length'] || '0'),
      responseSize,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
    };
  }

  async getAnalytics(startDate: Date, endDate: Date) {
    const usage = await this.prisma.apiUsage.groupBy({
      by: ['endpoint', 'method', 'statusCode'],
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: true,
      _avg: {
        responseTime: true,
      },
    });

    return usage;
  }
}
