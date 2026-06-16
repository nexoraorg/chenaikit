import { Request, Response } from 'express';
import { AuthController } from '../authController';

// Mock dependencies
jest.mock('../../utils/jwt');
jest.mock('../../utils/password');
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../prisma/client';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';

describe('AuthController', () => {
  let authController: AuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    authController = new AuthController();
    mockReq = {
      body: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('register', () => {
    it('should register a new user', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        role: 'user',
      });

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User registered' })
      );
    });

    it('should reject duplicate email', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'existing@example.com',
      });

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Email already registered' })
      );
    });

    it('should reject invalid email format', async () => {
      mockReq.body = {
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      await authController.register(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed_password',
        role: 'user',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(true);
      (generateAccessToken as jest.Mock).mockReturnValue('access_token');
      (hashPassword as jest.Mock).mockResolvedValue('refresh_token_hash');
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 1,
        tokenHash: 'refresh_token_hash',
      });

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access_token',
          refreshToken: expect.any(String),
        })
      );
    });

    it('should reject invalid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await authController.login(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid credentials' })
      );
    });
  });

  describe('refreshToken', () => {
    it('should handle invalid token format', async () => {
      mockReq.body = {
        token: 'invalid-token',
      };

      await authController.refreshToken(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
