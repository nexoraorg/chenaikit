import { Request, Response, NextFunction } from 'express';
import { PoolUtils } from '../utils/poolUtils';
import { prisma } from '../prisma/client';

/**
 * Middleware that checks database connection pool health before processing requests.
 * Helps prevent request hanging and detects leaks early.
 */
export const poolHealthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const isHealthy = await PoolUtils.checkConnection(prisma);
  
  if (!isHealthy) {
    return res.status(503).json({
      status: 'error',
      message: 'Database connection pool is unhealthy or exhausted',
    });
  }

  next();
};
