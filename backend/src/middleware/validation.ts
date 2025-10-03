import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/api';

export class ValidationMiddleware {
  static validateAccountId(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Account ID is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!/^[A-Za-z0-9]{1,56}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid account ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  }

  static validateAccountCreation(req: Request, res: Response, next: NextFunction) {
    const { name, email, publicKey } = req.body;
    const errors: ValidationError[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
    } else if (name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be 100 characters or less' });
    }

    if (!email || typeof email !== 'string') {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }

    if (!publicKey || typeof publicKey !== 'string') {
      errors.push({ field: 'publicKey', message: 'Public key is required' });
    } else if (!/^G[A-Z2-7]{55}$/.test(publicKey)) {
      errors.push({ field: 'publicKey', message: 'Invalid Stellar public key format. Must start with G and be 56 characters total using Base32 alphabet (A-Z, 2-7)' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  }

  static validatePagination(req: Request, res: Response, next: NextFunction) {
    const { page, limit, sortBy, sortOrder } = req.query;
    const errors: ValidationError[] = [];

    if (page && (isNaN(Number(page)) || Number(page) < 1)) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }

    if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
    }

    if (sortBy && !['timestamp', 'amount'].includes(sortBy as string)) {
      errors.push({ field: 'sortBy', message: 'Sort by must be either "timestamp" or "amount"' });
    }

    if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
      errors.push({ field: 'sortOrder', message: 'Sort order must be either "asc" or "desc"' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  }

  static sanitizeInput(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      }
    }
    next();
  }
}