import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Route classification with rate limit rules.
 * Requests over limit receive 429 with retry guidance.
 */

// Public API routes: standard limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Exempt health checks and internal routes
    return req.path === "/health" || req.path.startsWith("/_internal/");
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests. Please retry after some time.",
      retryAfter: req.rateLimit?.resetTime?.getTime(),
    });
  },
});

// Stricter limit for authentication attempts (login, register, etc.)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many authentication attempts. Please try again later.",
      retryAfter: req.rateLimit?.resetTime?.getTime(),
    });
  },
});
