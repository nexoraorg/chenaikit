import type { Application } from 'express';
import { getSecurityConfig } from '../config/security';
import { createCorsMiddleware } from './cors';
import { applySecurityHeaders } from './securityHeaders';
import {
  requestIdMiddleware,
  apiVersionMiddleware,
} from '../utils/headerUtils';

export const applySecurityMiddleware = (app: Application): void => {
  const config = getSecurityConfig();

  app.disable('x-powered-by');

  if (config.trustProxy !== undefined) {
    app.set('trust proxy', config.trustProxy);
  }

  // Security headers (helmet + custom)
  applySecurityHeaders(app, config.headers);

  // CORS
  app.use(createCorsMiddleware(config.cors));

  // Request ID injection
  app.use(
    requestIdMiddleware(
      config.requestMeta.requestIdHeader,
      config.requestMeta.enableRequestId
    )
  );

  // API version header
  app.use(
    apiVersionMiddleware(
      config.requestMeta.apiVersionHeader,
      config.requestMeta.apiVersion
    )
  );
};
