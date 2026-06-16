import cors from 'cors';
import type { RequestHandler } from 'express';
import type { CorsConfig } from '../config/security';

export const createCorsMiddleware = (config: CorsConfig): RequestHandler => {
  return cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);

      if (config.allowAll) return callback(null, true);

      if (config.origins.length === 0) return callback(null, false);

      if (config.origins.includes(origin)) return callback(null, true);

      return callback(null, false);
    },
    methods: config.methods,
    allowedHeaders: config.allowedHeaders,
    exposedHeaders: config.exposedHeaders,
    credentials: config.credentials,
    maxAge: config.maxAge,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
};
