import { v4 as uuidv4 } from "uuid";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type {
  PermissionsPolicyConfig,
  SecurityHeadersConfig,
} from "../config/security";

export const buildPermissionsPolicyHeader = (
  policy: PermissionsPolicyConfig,
): string => {
  const directives: string[] = [];

  for (const [feature, allowList] of Object.entries(policy)) {
    const kebab = feature.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    if (allowList.length === 0) {
      directives.push(`${kebab}=()`);
    } else {
      directives.push(`${kebab}=(${allowList.join(" ")})`);
    }
  }

  return directives.join(", ");
};

export const buildCspHeader = (csp: SecurityHeadersConfig["csp"]): string => {
  const parts: string[] = [];

  const add = (directive: string, values: string[]) => {
    if (values.length > 0) {
      parts.push(`${directive} ${values.join(" ")}`);
    }
  };

  add("default-src", csp.defaultSrc);
  add("script-src", csp.scriptSrc);
  add("style-src", csp.styleSrc);
  add("img-src", csp.imgSrc);
  add("connect-src", csp.connectSrc);
  add("font-src", csp.fontSrc);
  add("object-src", csp.objectSrc);
  add("media-src", csp.mediaSrc);
  add("frame-src", csp.frameSrc);
  add("frame-ancestors", csp.frameAncestors);
  add("form-action", csp.formAction);
  add("base-uri", csp.baseUri);

  if (csp.upgradeInsecureRequests) {
    parts.push("upgrade-insecure-requests");
  }

  return parts.join("; ");
};

export const generateRequestId = (): string => uuidv4();

export const validateSecurityHeaders = (res: Response): string[] => {
  const missing: string[] = [];
  const required = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "referrer-policy",
  ];

  for (const header of required) {
    if (!res.getHeader(header)) {
      missing.push(header);
    }
  }

  return missing;
};

export const requestIdMiddleware = (
  headerName: string,
  enabled: boolean,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      next();
      return;
    }

    const existing = req.headers[headerName.toLowerCase()] as
      | string
      | undefined;
    const requestId = existing || generateRequestId();

    req.headers[headerName.toLowerCase()] = requestId;
    res.setHeader(headerName, requestId);

    next();
  };
};

export const apiVersionMiddleware = (
  headerName: string,
  version: string,
): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(headerName, version);
    next();
  };
};
