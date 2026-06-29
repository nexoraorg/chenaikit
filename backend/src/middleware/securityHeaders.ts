import helmet from "helmet";
import type { Application, RequestHandler } from "express";
import type { SecurityHeadersConfig } from "../config/security";
import { buildPermissionsPolicyHeader } from "../utils/headerUtils";

export const createHelmetMiddleware = (
  config: SecurityHeadersConfig,
): RequestHandler => {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectivesForHelmet(config),
    },
    hsts: config.hsts || false,
    referrerPolicy: { policy: config.referrerPolicy as any },
    frameguard: {
      action:
        config.xFrameOptions.toLowerCase() === "deny" ? "deny" : "sameorigin",
    },
    noSniff: config.xContentTypeOptions,
    xssFilter: false,
    crossOriginEmbedderPolicy: config.crossOriginEmbedderPolicy,
    crossOriginOpenerPolicy: { policy: config.crossOriginOpenerPolicy as any },
    crossOriginResourcePolicy: {
      policy: config.crossOriginResourcePolicy as any,
    },
  });
};

const buildCspDirectivesForHelmet = (
  config: SecurityHeadersConfig,
): Record<string, any> => {
  const { csp } = config;
  const directives: Record<string, any> = {
    defaultSrc: csp.defaultSrc,
    scriptSrc: csp.scriptSrc,
    styleSrc: csp.styleSrc,
    imgSrc: csp.imgSrc,
    connectSrc: csp.connectSrc,
    fontSrc: csp.fontSrc,
    objectSrc: csp.objectSrc,
    mediaSrc: csp.mediaSrc,
    frameSrc: csp.frameSrc,
    frameAncestors: csp.frameAncestors,
    formAction: csp.formAction,
    baseUri: csp.baseUri,
  };

  if (csp.upgradeInsecureRequests) {
    directives["upgradeInsecureRequests"] = [];
  }

  return directives;
};

export const createCustomSecurityHeadersMiddleware = (
  config: SecurityHeadersConfig,
): RequestHandler => {
  const permissionsPolicyValue = buildPermissionsPolicyHeader(
    config.permissionsPolicy,
  );
  const xXssProtection = config.xXssProtection;

  return (_req, res, next) => {
    res.setHeader("X-XSS-Protection", xXssProtection);
    res.setHeader("Permissions-Policy", permissionsPolicyValue);
    next();
  };
};

export const applySecurityHeaders = (
  app: Application,
  config: SecurityHeadersConfig,
): void => {
  app.use(createHelmetMiddleware(config));
  app.use(createCustomSecurityHeadersMiddleware(config));
};
