import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../prisma/client';
import { getEmailService } from './emailService';
import { log } from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 12;
const RECOVERY_TOKEN_SECRET = process.env.MFA_RECOVERY_SECRET || 'dev-recovery-secret';
const KEY_DERIVATION_KEY = process.env.MFA_ENCRYPTION_KEY || 'dev-encryption-key-32-chars!';

function getCryptoKey(): Buffer {
  const key = crypto.scryptSync(KEY_DERIVATION_KEY, 'mfa-encryption', 32);
  return key;
}

function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const key = getCryptoKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decryptSecret(encrypted: string): string {
  const [ivHex, encryptedHex, authTagHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuf = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getCryptoKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedBuf);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface VerifyMFAInput {
  userId: string;
  token: string;
  isBackupCode?: boolean;
}

export class MFAService {
  static async setupMFA(userId: string, email: string): Promise<MFASetupResult> {
    const secret = speakeasy.generateSecret({
      name: `ChenAIKit (${email})`,
      issuer: 'ChenAIKit',
      length: 32,
    });

    const encryptedSecret = encryptSecret(secret.base32);

    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').slice(0, BACKUP_CODE_LENGTH);
      backupCodes.push(code);
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        backupCodes: JSON.stringify(hashedCodes),
        mfaEnabled: false,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
      },
    });

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url!,
      backupCodes,
    };
  }

  static async verifyMFA(input: VerifyMFAInput): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user || !user.mfaSecret) return false;

    if (user.mfaLockedUntil && new Date(user.mfaLockedUntil) > new Date()) {
      throw new Error('Account temporarily locked due to too many failed MFA attempts');
    }

    let isValid = false;

    try {
      if (input.isBackupCode && user.backupCodes) {
        const codes: string[] = JSON.parse(user.backupCodes);
        for (let i = 0; i < codes.length; i++) {
          const match = await bcrypt.compare(input.token, codes[i]);
          if (match) {
            isValid = true;
            const updatedCodes = [...codes];
            updatedCodes.splice(i, 1);
            await prisma.user.update({
              where: { id: input.userId },
              data: { backupCodes: JSON.stringify(updatedCodes) },
            });
            break;
          }
        }
      } else if (user.mfaSecret && user.mfaSecret.includes(':')) {
        const secret = decryptSecret(user.mfaSecret);
        isValid = speakeasy.totp.verify({
          secret,
          encoding: 'base32',
          token: input.token,
          window: 1,
        });
      }
    } catch (error: unknown) {
      // If decryption fails, treat as invalid token
      log.error('[mfa] Error verifying MFA token', new Error(String(error)));
      isValid = false;
    }

    if (isValid) {
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          mfaEnabled: true,
          mfaLastVerifiedAt: new Date(),
          mfaFailedAttempts: 0,
          mfaLockedUntil: null,
        },
      });
    } else {
      const newAttempts = (user.mfaFailedAttempts || 0) + 1;
      const maxAttempts = 10;
      const lockUntil = newAttempts >= maxAttempts ? new Date(Date.now() + 30 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: input.userId },
        data: {
          mfaFailedAttempts: newAttempts,
          mfaLockedUntil: lockUntil,
        },
      });
    }

    return isValid;
  }

  static async validateToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) return false;

    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
      return false;
    }

    const secret = decryptSecret(user.mfaSecret);
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  static async disableMFA(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const { comparePassword } = await import('../utils/password');
    const valid = await comparePassword(password, user.password);
    if (!valid) return false;

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        backupCodes: null,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
      },
    });

    return true;
  }

  static async getBackupCodes(userId: string): Promise<string[] | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.backupCodes || !user.mfaEnabled) return null;
    return JSON.parse(user.backupCodes);
  }

  static async regenerateBackupCodes(userId: string, password: string): Promise<string[] | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const { comparePassword } = await import('../utils/password');
    const valid = await comparePassword(password, user.password);
    if (!valid) return null;

    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').slice(0, BACKUP_CODE_LENGTH);
      backupCodes.push(code);
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: JSON.stringify(hashedCodes) },
    });

    return backupCodes;
  }

  static async sendRecoveryEmail(userId: string, recoveryEmail: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const encryptedToken = encryptSecret(token);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaRecoveryEmail: recoveryEmail,
      },
    });

    const recoveryLink = `${process.env.FRONTEND_URL}/auth/mfa-recovery?token=${token}&userId=${userId}`;

    const emailService = getEmailService();
    await emailService.send({
      to: recoveryEmail,
      subject: 'ChenAIKit MFA Recovery',
      template: 'password-reset',
      templateVars: {
        name: user.email.split('@')[0],
        resetUrl: recoveryLink,
        expiresIn: '15 minutes',
      },
    });

    log.info('[mfa] recovery email sent', { userId, recoveryEmail });
  }

  static async completeRecovery(token: string, userId: string, newTOTPSecret: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    try {
      decryptSecret(token);
    } catch {
      return false;
    }

    const encryptedSecret = encryptSecret(newTOTPSecret);

    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').slice(0, BACKUP_CODE_LENGTH);
      backupCodes.push(code);
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaEnabled: true,
        backupCodes: JSON.stringify(hashedCodes),
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        mfaLastVerifiedAt: new Date(),
      },
    });

    return true;
  }
}