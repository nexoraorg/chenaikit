import type { Application, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const parseOrigins = (origins: string | undefined): string[] => {
  if (!origins) return [];
  return origins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
};

const corsMiddleware = (): RequestHandler => {
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  const allowAll = process.env.CORS_ALLOW_ALL === 'true';

  return cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (allowAll) return callback(null, true);
      if (!origin) return callback(null, true);
      if (origins.length === 0) return callback(null, false);
      if (origins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    maxAge: 600,
  });
};

const helmetMiddleware = (): RequestHandler => {
  const isProd = process.env.NODE_ENV === 'production';

  const cspDirectives: NonNullable<helmet.ContentSecurityPolicyOptions['directives']> = {
    "default-src": ["'none'"],
    "base-uri": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'none'"],
    "img-src": ["'self'", 'data:'],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
  };

  if (isProd) {
    cspDirectives['upgrade-insecure-requests'] = [];
  }

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...cspDirectives,
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProd
      ? {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  });
};

export const applySecurityMiddleware = (app: Application): void => {
  app.disable('x-powered-by');

  if (process.env.TRUST_PROXY) {
    const parsed = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isFinite(parsed) ? parsed : process.env.TRUST_PROXY);
  }

  app.use(helmetMiddleware());
  app.use(corsMiddleware());
};
