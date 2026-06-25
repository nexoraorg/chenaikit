import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_WINDOWS } from '../config/rateLimit';

export const authRouteLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOWS.minute * 15,
  max: 10,
  message: { message: 'Too many requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createAccountRouteLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOWS.hour,
  max: 5,
  message: { message: 'Too many account creation attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
