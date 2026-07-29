/**
 * Validation Middleware Tests (Zod-based validate factory)
 *
 * Tests for the new `validate()` middleware factory, `ValidationComposer`,
 * and backward-compatible legacy `ValidationMiddleware` methods.
 */
import { Request, Response, NextFunction } from 'express';
import { validate, ValidationComposer, ValidationMiddleware } from '../validation';
import { z } from 'zod';

// Simple test schemas (coerce for query-like scenarios)
const testBodySchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().min(0),
});

const testParamsSchema = z.object({
  id: z.string().min(1),
});

const testQuerySchema = z.object({
  page: z.string().optional(),
});

describe('validate() middleware factory', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      method: 'POST',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('body validation', () => {
    it('should call next() when body is valid', () => {
      mockReq.body = { name: 'Alice', age: 30 };
      const middleware = validate({ body: testBodySchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // The error should be undefined if called without error
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should replace body with parsed data', () => {
      mockReq.body = { name: 'Alice', age: '30' as any };
      const middleware = validate({ body: testBodySchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({ name: 'Alice', age: 30 });
    });

    it('should call next(error) when body is invalid', () => {
      mockReq.body = { name: '', age: 30 };
      const middleware = validate({ body: testBodySchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.message).toContain('body validation failed');
      expect(error.statusCode).toBe(400);
    });

    it('should skip body validation for GET requests', () => {
      mockReq.method = 'GET';
      mockReq.body = {};
      const middleware = validate({ body: testBodySchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('params validation', () => {
    it('should call next() when params are valid', () => {
      mockReq.params = { id: '123' };
      const middleware = validate({ params: testParamsSchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next(error) when params are invalid', () => {
      mockReq.params = { id: '' };
      const middleware = validate({ params: testParamsSchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Path parameter validation failed');
    });
  });

  describe('query validation', () => {
    it('should call next() when query is valid', () => {
      mockReq.query = { page: '1' };
      const middleware = validate({ query: testQuerySchema });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('combined validation', () => {
    it('should validate params before query', () => {
      mockReq.params = { id: '' };
      mockReq.query = { page: '1' };
      const middleware = validate({
        params: testParamsSchema,
        query: testQuerySchema,
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Path parameter validation failed');
    });

    it('should validate all when all are correct', () => {
      mockReq.params = { id: '123' };
      mockReq.query = { page: '1' };
      mockReq.body = { name: 'Bob', age: 25 };
      const middleware = validate({
        params: testParamsSchema,
        query: testQuerySchema,
        body: testBodySchema,
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});

describe('ValidationComposer', () => {
  it('should build middleware array', () => {
    const composer = new ValidationComposer()
      .params(testParamsSchema)
      .query(testQuerySchema)
      .withSanitization();

    const middleware = composer.build();
    expect(middleware).toHaveLength(2); // sanitize + validate
  });

  it('should build without sanitization', () => {
    const composer = new ValidationComposer()
      .body(testBodySchema);

    const middleware = composer.build();
    expect(middleware).toHaveLength(1);
  });
});

describe('ValidationMiddleware (legacy)', () => {
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
    it('should pass with valid account ID', () => {
      mockReq.params = { id: 'GACCOUNT123456789' };
      ValidationMiddleware.validateAccountId(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with missing account ID', () => {
      mockReq.params = {};
      ValidationMiddleware.validateAccountId(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validatePagination', () => {
    it('should pass with valid pagination', () => {
      mockReq.query = { page: '1', limit: '10' };
      ValidationMiddleware.validatePagination(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    it('should trim string values', () => {
      mockReq.body = { name: '  Test  ' };
      ValidationMiddleware.sanitizeInput(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockReq.body.name).toBe('Test');
    });
  });
});
