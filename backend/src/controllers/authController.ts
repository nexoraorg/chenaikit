import { Request, Response } from 'express';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken } from '../utils/jwt';
import { prisma } from '../prisma/client';
import { UserPayload } from '../types/auth';
import crypto from 'crypto';
import { z } from 'zod';

const durationToMs = (input: string): number => {
  const trimmed = input.trim();
  const match = /^([0-9]+)\s*(ms|s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    throw new Error('Invalid REFRESH_TOKEN_EXPIRATION format');
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

const getRefreshTokenTtlMs = (): number => {
  const exp = process.env.REFRESH_TOKEN_EXPIRATION || '7d';
  return durationToMs(exp);
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  token: z.string().min(1),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, role } = registerSchema.parse(req.body);
      const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
      if (existing) return res.status(400).json({ message: 'Email already registered' });

      const hashed = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, password: hashed, role: role || 'user' },
      });

      res.status(201).json({ message: 'User registered', userId: user.id });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Registration failed' });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      const valid = await comparePassword(password, user.password);
      if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

      const payload: UserPayload = { id: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(payload);
      const refreshTokenRaw = crypto.randomBytes(64).toString('hex');
      const refreshTokenHash = await hashPassword(refreshTokenRaw);

      const stored = await prisma.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
        },
      });

      res.json({ accessToken, refreshToken: `${stored.id}.${refreshTokenRaw}` });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Login failed' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { token } = refreshSchema.parse(req.body);
      const [idPart, tokenPart] = token.split('.', 2);

      const id = Number(idPart);
      if (!Number.isFinite(id) || !tokenPart) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }


      if (!matched) return res.status(403).json({ message: 'Invalid refresh token' });
      if (matched.expiresAt < new Date()) return res.status(403).json({ message: 'Refresh token expired' });
      if (matched.user?.deletedAt) {
        await prisma.refreshToken.deleteMany({ where: { userId: matched.user.id } });
        return res.status(403).json({ message: 'Account disabled' });
      }

      const stored = await prisma.refreshToken.findUnique({ where: { id }, include: { user: true } });
      if (!stored) return res.status(403).json({ message: 'Invalid refresh token' });
      if (stored.expiresAt < new Date()) return res.status(403).json({ message: 'Refresh token expired' });

      const matches = await comparePassword(tokenPart, stored.tokenHash);
      if (!matches) return res.status(403).json({ message: 'Invalid refresh token' });

      // Rotate refresh token on successful use
      const newRefreshTokenRaw = crypto.randomBytes(64).toString('hex');
      const newRefreshTokenHash = await hashPassword(newRefreshTokenRaw);

      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: {
          tokenHash: newRefreshTokenHash,
          expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
        },
      });


      const payload: UserPayload = {
        id: stored.user.id,
        email: stored.user.email,
        role: stored.user.role,
      };
      const accessToken = generateAccessToken(payload);
      res.json({ accessToken, refreshToken: `${stored.id}.${newRefreshTokenRaw}` });
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Token refresh failed' });
    }
  }
}
