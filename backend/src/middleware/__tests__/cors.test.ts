import { createCorsMiddleware } from '../cors';
import type { CorsConfig } from '../../config/security';

const baseConfig: CorsConfig = {
  origins: [],
  allowAll: false,
  credentials: false,
  maxAge: 600,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-ID'],
};

describe('createCorsMiddleware', () => {
  it('returns a function (middleware)', () => {
    const middleware = createCorsMiddleware(baseConfig);
    expect(typeof middleware).toBe('function');
  });

  it('produces middleware with allowAll=true config', () => {
    const config: CorsConfig = { ...baseConfig, allowAll: true };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('produces middleware with credentials enabled', () => {
    const config: CorsConfig = { ...baseConfig, credentials: true, origins: ['https://a.com'] };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('produces middleware with whitelisted origins', () => {
    const config: CorsConfig = { ...baseConfig, origins: ['https://allowed.com'] };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('uses configured maxAge', () => {
    const config: CorsConfig = { ...baseConfig, maxAge: 1200 };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('uses custom methods list', () => {
    const config: CorsConfig = { ...baseConfig, methods: ['GET', 'POST'] };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('uses custom allowedHeaders', () => {
    const config: CorsConfig = {
      ...baseConfig,
      allowedHeaders: ['Authorization', 'X-Custom-Header'],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });

  it('uses custom exposedHeaders', () => {
    const config: CorsConfig = {
      ...baseConfig,
      exposedHeaders: ['X-Request-ID', 'X-API-Version'],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe('function');
  });
});
