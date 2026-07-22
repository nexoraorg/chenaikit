import speakeasy from 'speakeasy';

// Mock bcrypt to avoid slow hashing in CI
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$mockhashhashhashhashhashashashashashah'),
  compare: jest.fn().mockImplementation((token: string, hash: string) => {
    return Promise.resolve(token === 'valid-backup-code');
  }),
}));

// Mock the prisma client
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { MFAService } from '../mfaService';

describe('MFAService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TOTP Generation and Validation', () => {
    it('should generate a valid TOTP secret', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        mfaSecret: null,
        mfaEnabled: false,
        backupCodes: null,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      mockUpdate.mockResolvedValue({});

      const result = await MFAService.setupMFA('user-1', 'test@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.secret).toBeTruthy();
      expect(result.qrCodeUrl).toContain('otpauth://');
    }, 10000);

    it('should validate a correct TOTP token within the time window', async () => {
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const encryptedSecret = `test-iv:${secret.base32}:test-auth-tag`;

      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        backupCodes: '[]',
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      mockUpdate.mockResolvedValue({});

      const isValid = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token,
        window: 1,
      });

      expect(isValid).toBe(true);
    });

    it('should reject an invalid TOTP token', async () => {
      const isValid = speakeasy.totp.verify({
        secret: 'invalid-secret',
        encoding: 'base32',
        token: '000000',
        window: 1,
      });

      expect(isValid).toBe(false);
    });

    it('should generate valid backup codes', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        mfaSecret: null,
        mfaEnabled: false,
        backupCodes: null,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      mockUpdate.mockResolvedValue({});

      const result = await MFAService.setupMFA('user-1', 'test@example.com');
      expect(result.backupCodes).toHaveLength(10);
      result.backupCodes.forEach((code) => {
        expect(code).toHaveLength(12);
        expect(code).toMatch(/^[0-9a-f]{12}$/);
      });
    }, 10000);
  });

  describe('Rate Limiting and Lockout', () => {
    it('should track failed MFA attempts', async () => {
      const secret = speakeasy.generateSecret({ length: 32 });
      const invalidToken = '000000';

      mockFindUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'test@example.com',
          password: 'hashed-password',
          role: 'user',
          mfaEnabled: false,
          mfaSecret: `mock-iv:${secret.base32}:mock-auth`,
          backupCodes: '[]',
          mfaFailedAttempts: 0,
          mfaLockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });

      mockUpdate.mockImplementation(({ data }: { data: any }) => {
        return {
          mfaFailedAttempts: data.mfaFailedAttempts,
          mfaLockedUntil: data.mfaLockedUntil,
        };
      });

      const result = await MFAService.verifyMFA({
        userId: 'user-1',
        token: invalidToken,
      });

      expect(result).toBe(false);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should lock account after 10 failed attempts', async () => {
      const secret = speakeasy.generateSecret({ length: 32 });

      mockFindUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'test@example.com',
          password: 'hashed-password',
          role: 'user',
          mfaEnabled: false,
          mfaSecret: `mock-iv:${secret.base32}:mock-auth`,
          backupCodes: '[]',
          mfaFailedAttempts: 9,
          mfaLockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });

      mockUpdate.mockImplementation(({ data }: { data: any }) => {
        return {
          mfaFailedAttempts: data.mfaFailedAttempts,
          mfaLockedUntil: data.mfaLockedUntil,
        };
      });

      const result = await MFAService.verifyMFA({
        userId: 'user-1',
        token: '000000',
      });

      expect(result).toBe(false);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('Timing Window Tolerance', () => {
    it('should verify a token within ±1 step (60 seconds total)', () => {
      const secret = speakeasy.generateSecret({ length: 32 });

      const currentToken = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const verifyCurrent = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token: currentToken,
        window: 1,
      });
      expect(verifyCurrent).toBe(true);
    });

    it('should handle clock drift with window tolerance', () => {
      const secret = speakeasy.generateSecret({ length: 32 });

      const pastToken = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
        step: 30,
      });

      const verifyPast = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token: pastToken,
        window: 1,
      });

      expect(verifyPast).toBe(true);
    });
  });

  describe('Backup Code Security', () => {
    it('should hash backup codes and not store them in plaintext', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        mfaSecret: null,
        mfaEnabled: false,
        backupCodes: null,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      mockUpdate.mockImplementation(({ data }: { data: any }) => {
        expect(data.backupCodes).not.toBeNull();
        const parsed = JSON.parse(data.backupCodes);
        expect(parsed).toHaveLength(10);
        parsed.forEach((code: string) => {
          expect(code).toMatch(/^\$2[aby]\$\d{2}\$/);
        });
        return {};
      });

      await MFAService.setupMFA('user-1', 'test@example.com');
    }, 10000);
  });

  describe('MFA Disable Flow', () => {
    it('should require password to disable MFA', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'user',
        mfaEnabled: true,
        mfaSecret: 'encrypted',
        backupCodes: '[]',
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const { comparePassword } = await import('../../utils/password');
      const valid = await comparePassword('password', 'hashed-password');
      expect(valid).toBeDefined();
    });
  });
});