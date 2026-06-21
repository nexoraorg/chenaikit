import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../jwt';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('JWT Utils', () => {
  const mockPayload = { id: '1', email: 'test@example.com', role: 'user' };
  const mockToken = 'mock.jwt.token';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_EXPIRATION = '15m';
    process.env.REFRESH_TOKEN_EXPIRATION = '7d';
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = generateAccessToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-access-secret',
        expect.objectContaining({ expiresIn: '15m' })
      );
      expect(token).toBe(mockToken);
    });

    it('should use default expiration if not set', () => {
      delete process.env.ACCESS_TOKEN_EXPIRATION;
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      generateAccessToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        expect.any(String),
        expect.objectContaining({ expiresIn: '15m' })
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = generateRefreshToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-refresh-secret',
        expect.objectContaining({ expiresIn: '7d' })
      );
      expect(token).toBe(mockToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyAccessToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-access-secret');
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifyAccessToken('invalid-token')).toThrow('Invalid token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyRefreshToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-refresh-secret');
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for expired token', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => verifyRefreshToken(mockToken)).toThrow('Token expired');
    });
  });
});
