import { Request, Response } from 'express';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken } from '../utils/jwt';
import { prisma } from '../prisma/client';
import { UserPayload } from '../types/auth';
import crypto from 'crypto';
import { z } from 'zod';
import {
  AuthenticationError,
  ConflictError
} from '../utils/errors';

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
    const { email, password, role } = registerSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) {
      throw new ConflictError('Email already registered', { email });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashed, role: role || 'user' },
    });

    res.status(201).json({ message: 'User registered', userId: user.id });
  }

  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const payload: UserPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshTokenRaw = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await hashPassword(refreshTokenRaw);

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
      },
    });

    res.json({ accessToken, refreshToken: refreshTokenRaw });
  }

  async refreshToken(req: Request, res: Response) {
    const { token } = refreshSchema.parse(req.body);
    const [idPart, tokenPart] = token.split('.', 2);

    const id = Number(idPart);
    if (!Number.isFinite(id) || !tokenPart) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id }, include: { user: true } });
    if (!stored) {
      throw new AuthenticationError('Invalid refresh token');
    }
    if (stored.expiresAt < new Date()) {
      throw new AuthenticationError('Refresh token expired');
    }

    const matches = await comparePassword(tokenPart, stored.tokenHash);
    if (!matches) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (stored.user?.deletedAt) {
      await prisma.refreshToken.deleteMany({ where: { userId: stored.user.id } });
      throw new AuthenticationError('Account disabled');
    }

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

    const user = stored.user;
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = generateAccessToken(payload);
    res.json({ accessToken });
  }
}
