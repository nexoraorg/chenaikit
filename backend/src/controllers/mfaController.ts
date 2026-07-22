import { Request, Response } from 'express';
import { MFAService } from '../services/mfaService';
import { prisma } from '../prisma/client';
import { UserPayload } from '../types/auth';
import { AuthenticationError, ValidationError } from '../utils/errors';

export class MFAController {
  async setup(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const result = await MFAService.setupMFA(user.id, user.email);

    res.json({
      secret: result.secret,
      qrCodeUrl: result.qrCodeUrl,
      backupCodes: result.backupCodes,
    });
  }

  async verify(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const { token, isBackupCode } = req.body;

    if (!token || typeof token !== 'string') {
      throw new ValidationError('TOTP token is required');
    }

    const isValid = await MFAService.verifyMFA({
      userId: user.id,
      token,
      isBackupCode: !!isBackupCode,
    });

    if (!isValid) {
      throw new AuthenticationError('Invalid MFA token');
    }

    res.json({ message: 'MFA enabled successfully', verified: true });
  }

  async challenge(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const { token, isBackupCode } = req.body;

    if (!token || typeof token !== 'string') {
      throw new ValidationError('TOTP token is required');
    }

    const isValid = await MFAService.validateToken(user.id, token);

    if (!isValid) {
      throw new AuthenticationError('Invalid MFA token');
    }

    res.json({ message: 'MFA verified', verified: true });
  }

  async disable(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required to disable MFA');
    }

    const success = await MFAService.disableMFA(user.id, password);
    if (!success) {
      throw new AuthenticationError('Invalid password');
    }

    res.json({ message: 'MFA disabled successfully' });
  }

  async getBackupCodes(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const codes = await MFAService.getBackupCodes(user.id);

    if (!codes) {
      res.json({ backupCodes: [] });
      return;
    }

    res.json({ backupCodes: codes });
  }

  async regenerateBackupCodes(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required to regenerate backup codes');
    }

    const codes = await MFAService.regenerateBackupCodes(user.id, password);
    if (!codes) {
      throw new AuthenticationError('Invalid password');
    }

    res.json({ backupCodes: codes });
  }

  async sendRecovery(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const { recoveryEmail } = req.body;

    if (!recoveryEmail || typeof recoveryEmail !== 'string') {
      throw new ValidationError('Recovery email is required');
    }

    await MFAService.sendRecoveryEmail(user.id, recoveryEmail);
    res.json({ message: 'Recovery email sent' });
  }

  async completeRecovery(req: Request, res: Response) {
    const { token, userId, newSecret } = req.body;

    if (!token || !userId || !newSecret) {
      throw new ValidationError('Token, userId, and newSecret are required');
    }

    const success = await MFAService.completeRecovery(token, userId, newSecret);
    if (!success) {
      throw new AuthenticationError('Invalid recovery token');
    }

    res.json({ message: 'MFA recovery completed successfully' });
  }

  async status(req: Request, res: Response) {
    const user = req.user as UserPayload;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mfaEnabled: true,
        mfaRecoveryEmail: true,
        mfaLastVerifiedAt: true,
        mfaFailedAttempts: true,
        mfaLockedUntil: true,
      },
    });

    res.json({
      mfaEnabled: dbUser?.mfaEnabled ?? false,
      recoveryEmail: dbUser?.mfaRecoveryEmail ?? null,
      lastVerifiedAt: dbUser?.mfaLastVerifiedAt ?? null,
      failedAttempts: dbUser?.mfaFailedAttempts ?? 0,
      lockedUntil: dbUser?.mfaLockedUntil ?? null,
    });
  }
}