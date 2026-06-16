import jwt, { SignOptions } from 'jsonwebtoken';
import { UserPayload } from '../types/auth';

const getSecret = (key: 'ACCESS_TOKEN_SECRET' | 'REFRESH_TOKEN_SECRET'): string => {
  const value = process.env[key];
  if (value && value.length > 0) return value;

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return key === 'ACCESS_TOKEN_SECRET' ? 'dev_access_secret' : 'dev_refresh_secret';
  }

  throw new Error(`${key} is required (missing for NODE_ENV=${process.env.NODE_ENV || 'unknown'})`);
};

const getAccessTokenExp = (): string => {
  return process.env.ACCESS_TOKEN_EXPIRATION || '15m';
};

const getRefreshTokenExp = (): string => {
  return process.env.REFRESH_TOKEN_EXPIRATION || '7d';
};

export const generateAccessToken = (payload: UserPayload): string => {
  return jwt.sign(payload, getSecret('ACCESS_TOKEN_SECRET'), { expiresIn: getAccessTokenExp() } as SignOptions);
};

export const generateRefreshToken = (payload: UserPayload): string => {
  return jwt.sign(payload, getSecret('REFRESH_TOKEN_SECRET'), { expiresIn: getRefreshTokenExp() } as SignOptions);
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, getSecret('ACCESS_TOKEN_SECRET')) as UserPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, getSecret('REFRESH_TOKEN_SECRET')) as UserPayload;
};
