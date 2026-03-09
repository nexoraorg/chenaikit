import jwt, { SignOptions } from 'jsonwebtoken';
import { UserPayload } from '../types/auth';

const getSecret = (key: 'ACCESS_TOKEN_SECRET' | 'REFRESH_TOKEN_SECRET'): string => {
  const value = process.env[key];
  if (value && value.length > 0) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${key} is required in production`);
  }

  // Development/test fallback only
  return key === 'ACCESS_TOKEN_SECRET' ? 'dev_access_secret' : 'dev_refresh_secret';
};
const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXPIRATION || '15m';
const REFRESH_TOKEN_EXP = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

export const generateAccessToken = (payload: UserPayload): string => {
  return jwt.sign(payload, getSecret('ACCESS_TOKEN_SECRET'), { expiresIn: ACCESS_TOKEN_EXP } as SignOptions);
};

export const generateRefreshToken = (payload: UserPayload): string => {
  return jwt.sign(payload, getSecret('REFRESH_TOKEN_SECRET'), { expiresIn: REFRESH_TOKEN_EXP } as SignOptions);
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, getSecret('ACCESS_TOKEN_SECRET')) as UserPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, getSecret('REFRESH_TOKEN_SECRET')) as UserPayload;
};
