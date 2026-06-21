import { Request, Response, NextFunction } from 'express';
import { ValidationMiddleware } from '../validation';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('validateAccountId', () => {
    it('should pass validation with valid account ID', () => {
      mockReq.params = { id: 'GACCOUNT123456789' };

      ValidationMiddleware.validateAccountId(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation with missing account ID', () => {
      mockReq.params = {};

      ValidationMiddleware.validateAccountId(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid account ID format', () => {
      mockReq.params = { id: 'invalid@id!' };

      ValidationMiddleware.validateAccountId(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateAccountCreation', () => {
    it('should pass validation with valid data', () => {
      mockReq.body = {
        name: 'Test User',
        email: 'test@example.com',
        publicKey: 'GABC234567DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP',
      };

      ValidationMiddleware.validateAccountCreation(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid email', () => {
      mockReq.body = {
        name: 'Test User',
        email: 'invalid-email',
        publicKey: 'GABC234567DEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP',
      };

      ValidationMiddleware.validateAccountCreation(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid public key', () => {
      mockReq.body = {
        name: 'Test User',
        email: 'test@example.com',
        publicKey: 'INVALID_KEY',
      };

      ValidationMiddleware.validateAccountCreation(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validatePagination', () => {
    it('should pass validation with valid pagination params', () => {
      mockReq.query = { page: '1', limit: '10', sortBy: 'timestamp', sortOrder: 'desc' };

      ValidationMiddleware.validatePagination(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail validation with invalid page', () => {
      mockReq.query = { page: '-1' };

      ValidationMiddleware.validatePagination(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should fail validation with limit over 100', () => {
      mockReq.query = { limit: '101' };

      ValidationMiddleware.validatePagination(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('sanitizeInput', () => {
    it('should trim string values in body', () => {
      mockReq.body = {
        name: '  Test User  ',
        email: '  test@example.com  ',
      };

      ValidationMiddleware.sanitizeInput(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.body.name).toBe('Test User');
      expect(mockReq.body.email).toBe('test@example.com');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
