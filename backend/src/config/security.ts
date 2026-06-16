export interface CorsConfig {
  origins: string[];
  allowAll: boolean;
  credentials: boolean;
  maxAge: number;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
}

export interface CspDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  frameSrc: string[];
  frameAncestors: string[];
  formAction: string[];
  baseUri: string[];
  upgradeInsecureRequests: boolean;
}

export interface HstsConfig {
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

export interface PermissionsPolicyConfig {
  camera: string[];
  microphone: string[];
  geolocation: string[];
  payment: string[];
  usb: string[];
  fullscreen: string[];
}

export interface SecurityHeadersConfig {
  csp: CspDirectives;
  hsts: HstsConfig | false;
  referrerPolicy: string;
  xFrameOptions: string;
  xContentTypeOptions: boolean;
  xXssProtection: string;
  permissionsPolicy: PermissionsPolicyConfig;
  crossOriginEmbedderPolicy: boolean;
  crossOriginOpenerPolicy: string;
  crossOriginResourcePolicy: string;
}

export interface RateLimitHeadersConfig {
  enabled: boolean;
  headerPrefix: string;
}

export interface RequestMetaConfig {
  apiVersionHeader: string;
  apiVersion: string;
  requestIdHeader: string;
  enableRequestId: boolean;
}

export interface SecurityConfig {
  cors: CorsConfig;
  headers: SecurityHeadersConfig;
  rateLimit: RateLimitHeadersConfig;
  requestMeta: RequestMetaConfig;
  trustProxy: string | number | undefined;
}

const isProduction = () => process.env.NODE_ENV === 'production';
const isDevelopmentOrTest = () =>
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const parseOrigins = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};

const parseTrustProxy = (): string | number | undefined => {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
};

export const getSecurityConfig = (): SecurityConfig => {
  const isProd = isProduction();

  return {
    cors: {
      origins: parseOrigins(process.env.CORS_ORIGINS),
      allowAll:
        process.env.CORS_ALLOW_ALL === 'true' && isDevelopmentOrTest(),
      credentials: process.env.CORS_CREDENTIALS === 'true',
      maxAge: Number(process.env.CORS_MAX_AGE) || 600,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-API-Key',
        'X-Request-ID',
        'X-API-Version',
      ],
      exposedHeaders: ['X-Request-ID', 'X-API-Version', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    },

    headers: {
      csp: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        baseUri: ["'none'"],
        upgradeInsecureRequests: isProd,
      },
      hsts: isProd
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      referrerPolicy: process.env.REFERRER_POLICY || 'no-referrer',
      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      xXssProtection: '1; mode=block',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        fullscreen: ["'self'"],
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
    },

    rateLimit: {
      enabled: process.env.RATE_LIMIT_HEADERS !== 'false',
      headerPrefix: 'X-RateLimit',
    },

    requestMeta: {
      apiVersionHeader: 'X-API-Version',
      apiVersion: process.env.API_VERSION || 'v1',
      requestIdHeader: 'X-Request-ID',
      enableRequestId: process.env.ENABLE_REQUEST_ID !== 'false',
    },

    trustProxy: parseTrustProxy(),
  };
};
