import {
  createHelmetMiddleware,
  createCustomSecurityHeadersMiddleware,
  applySecurityHeaders,
} from "../securityHeaders";
import type { SecurityHeadersConfig } from "../../config/security";
import type { Application } from "express";

const baseConfig: SecurityHeadersConfig = {
  csp: {
    defaultSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'none'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'none'"],
    baseUri: ["'none'"],
    upgradeInsecureRequests: false,
  },
  hsts: false,
  referrerPolicy: "no-referrer",
  xFrameOptions: "DENY",
  xContentTypeOptions: true,
  xXssProtection: "1; mode=block",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    fullscreen: ["'self'"],
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
};

describe("createHelmetMiddleware", () => {
  it("returns a middleware function", () => {
    const middleware = createHelmetMiddleware(baseConfig);
    expect(typeof middleware).toBe("function");
  });

  it("returns a middleware function with HSTS enabled", () => {
    const config: SecurityHeadersConfig = {
      ...baseConfig,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    };
    const middleware = createHelmetMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("accepts upgradeInsecureRequests in CSP", () => {
    const config: SecurityHeadersConfig = {
      ...baseConfig,
      csp: { ...baseConfig.csp, upgradeInsecureRequests: true },
    };
    const middleware = createHelmetMiddleware(config);
    expect(typeof middleware).toBe("function");
  });
});

describe("createCustomSecurityHeadersMiddleware", () => {
  it("returns a middleware function", () => {
    const middleware = createCustomSecurityHeadersMiddleware(baseConfig);
    expect(typeof middleware).toBe("function");
  });

  it("sets X-XSS-Protection and Permissions-Policy on response", () => {
    const middleware = createCustomSecurityHeadersMiddleware(baseConfig);
    const headers: Record<string, string> = {};
    const req = {} as any;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Permissions-Policy"]).toBeDefined();
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("fullscreen=('self')");
  });

  it("always calls next()", () => {
    const middleware = createCustomSecurityHeadersMiddleware(baseConfig);
    const req = {} as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("applySecurityHeaders", () => {
  it("calls app.use twice (helmet + custom headers)", () => {
    const useSpy = jest.fn();
    const app = { use: useSpy } as unknown as Application;

    applySecurityHeaders(app, baseConfig);

    expect(useSpy).toHaveBeenCalledTimes(2);
  });
});
