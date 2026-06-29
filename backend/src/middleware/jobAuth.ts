/**
 * Job authentication middleware for securing job management endpoints.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      jobUser?: JobUser;
    }
  }
}

export interface JobUser {
  id: string;
  role: string;
  permissions: string[];
}

/**
 * Middleware to authenticate job management requests
 * Uses JWT tokens similar to the main auth middleware but with job-specific permissions
 */
export const authenticateJob = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: { message: 'Job management token missing' }
    });
  }

  try {
    const payload = verifyAccessToken(token) as any;
    
    // Check if user has job management permissions
    if (!hasJobPermissions(payload)) {
      return res.status(403).json({ 
        success: false,
        error: { message: 'Insufficient permissions for job management' }
      });
    }

    req.jobUser = {
      id: payload.id,
      role: payload.role,
      permissions: payload.permissions || [],
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false,
      error: { message: 'Invalid or expired job management token' }
    });
  }
};

/**
 * Middleware to authorize specific job operations
 */
export const authorizeJobOperation = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jobUser) {
      return res.status(401).json({ 
        success: false,
        error: { message: 'Job user not authenticated' }
      });
    }

    if (!req.jobUser.permissions.includes(requiredPermission) && req.jobUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: { message: `Permission '${requiredPermission}' required` }
      });
    }

    next();
  };
};

/**
 * Check if user has job management permissions
 */
function hasJobPermissions(payload: any): boolean {
  const allowedRoles = ['admin', 'job_manager', 'system'];
  if (allowedRoles.includes(payload.role)) {
    return true;
  }

  const permissions = payload.permissions || [];
  const jobPermissions = [
    'job:read',
    'job:write',
    'job:delete',
    'job:manage',
    'job:retry',
  ];

  return jobPermissions.some(perm => permissions.includes(perm));
}

/**
 * Middleware to validate job API key (alternative to JWT for service-to-service communication)
 */
export const validateJobApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-job-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ 
      success: false,
      error: { message: 'Job API key missing' }
    });
  }

  // In production, validate against stored API keys
  // For now, check if it matches expected format
  const expectedPrefix = 'job_';
  if (!apiKey.startsWith(expectedPrefix)) {
    return res.status(403).json({ 
      success: false,
      error: { message: 'Invalid job API key format' }
    });
  }

  next();
};

/**
 * Rate limiting middleware specifically for job endpoints
 * More lenient than general API rate limiting
 */
export const jobRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.jobUser?.id || req.ip || 'unknown';
    const now = Date.now();
    
    const record = requestCounts.get(key);
    
    if (!record || now > record.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);
      return res.status(429).json({ 
        success: false,
        error: { 
          message: 'Job rate limit exceeded',
          retryAfter: resetIn 
        }
      });
    }

    record.count++;
    next();
  };
};
