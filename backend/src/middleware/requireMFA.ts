import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { UserPayload } from '../types/auth';

/**
 * Middleware that requires MFA to be enabled and verified for the current session.
 * If the user has MFA enabled but hasn't verified it in this session, it returns a 403
 * with a flag indicating MFA verification is needed.
 */
export const requireMFA = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserPayload | undefined;
  
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mfaEnabled: true,
        mfaLastVerifiedAt: true,
        mfaFailedAttempts: true,
        mfaLockedUntil: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    // If MFA is not enabled on the account, skip the check
    if (!dbUser.mfaEnabled) {
      return next();
    }

    // Check if account is locked due to too many failed attempts
    if (dbUser.mfaLockedUntil && new Date(dbUser.mfaLockedUntil) > new Date()) {
      return res.status(423).json({
        message: 'Account locked due to too many failed MFA attempts',
        mfaLocked: true,
        lockedUntil: dbUser.mfaLockedUntil,
      });
    }

    // Check if MFA was verified in this session
    const mfaVerifiedInSession = (req as any).session?.mfaVerified || false;
    
    // If MFA hasn't been verified in this session, require it
    if (!mfaVerifiedInSession) {
      return res.status(403).json({
        message: 'MFA verification required',
        mfaRequired: true,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error checking MFA status' });
  }
};

/**
 * Middleware to mark MFA as verified for the current session
 */
export const markMFAVerified = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req as any).session) {
    (req as any).session.mfaVerified = true;
  }
  next();
};

/**
 * Middleware to clear MFA verification status
 */
export const clearMFAVerified = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).session) {
    (req as any).session.mfaVerified = false;
  }
  next();
};

export default requireMFA;