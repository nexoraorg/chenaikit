import {
  buildPermissionsPolicyHeader,
  buildCspHeader,
  generateRequestId,
  validateSecurityHeaders,
  requestIdMiddleware,
  apiVersionMiddleware,
} from "../headerUtils";
import type {
  SecurityHeadersConfig,
  PermissionsPolicyConfig,
} from "../../config/security";

describe("buildPermissionsPolicyHeader", () => {
  it("builds empty directives with empty arrays", () => {
    const policy: PermissionsPolicyConfig = {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      fullscreen: [],
    };
    const result = buildPermissionsPolicyHeader(policy);
    expect(result).toContain("camera=()");
    expect(result).toContain("microphone=()");
    expect(result).toContain("geolocation=()");
  });

  it("builds directives with allowed origins", () => {
    const policy: PermissionsPolicyConfig = {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      fullscreen: ["'self'"],
    };
    const result = buildPermissionsPolicyHeader(policy);
    expect(result).toContain("fullscreen=('self')");
  });

  it("separates directives with commas", () => {
    const policy: PermissionsPolicyConfig = {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      fullscreen: [],
    };
    const result = buildPermissionsPolicyHeader(policy);
    expect(result).toContain(", ");
  });
});

describe("buildCspHeader", () => {
  const csp: SecurityHeadersConfig["csp"] = {
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
  };

  it("includes default-src directive", () => {
    const result = buildCspHeader(csp);
    expect(result).toContain("default-src 'none'");
  });

  it("includes script-src directive", () => {
    const result = buildCspHeader(csp);
    expect(result).toContain("script-src 'self'");
  });

  it("includes img-src with multiple values", () => {
    const result = buildCspHeader(csp);
    expect(result).toContain("img-src 'self' data:");
  });

  it("does not include upgrade-insecure-requests when false", () => {
    const result = buildCspHeader(csp);
    expect(result).not.toContain("upgrade-insecure-requests");
  });

  it("includes upgrade-insecure-requests when true", () => {
    const result = buildCspHeader({ ...csp, upgradeInsecureRequests: true });
    expect(result).toContain("upgrade-insecure-requests");
  });

  it("separates directives with semicolons", () => {
    const result = buildCspHeader(csp);
    expect(result).toContain("; ");
  });
});

describe("generateRequestId", () => {
  it("generates a valid UUID v4", () => {
    const id = generateRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 10 }, generateRequestId));
    expect(ids.size).toBe(10);
  });
});

describe("validateSecurityHeaders", () => {
  const makeRes = (presentHeaders: string[] = []) => {
    const headers: Record<string, string> = {};
    for (const h of presentHeaders) {
      headers[h] = "set";
    }
    return {
      getHeader: (name: string) => headers[name.toLowerCase()] ?? null,
    } as any;
  };

  it("returns all required headers as missing when none are set", () => {
    const res = makeRes();
    const missing = validateSecurityHeaders(res);
    expect(missing).toContain("content-security-policy");
    expect(missing).toContain("x-frame-options");
    expect(missing).toContain("x-content-type-options");
    expect(missing).toContain("strict-transport-security");
    expect(missing).toContain("referrer-policy");
  });

  it("returns empty array when all required headers are set", () => {
    const res = makeRes([
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "strict-transport-security",
      "referrer-policy",
    ]);
    const missing = validateSecurityHeaders(res);
    expect(missing).toHaveLength(0);
  });

  it("returns only missing headers", () => {
    const res = makeRes(["content-security-policy", "x-frame-options"]);
    const missing = validateSecurityHeaders(res);
    expect(missing).not.toContain("content-security-policy");
    expect(missing).not.toContain("x-frame-options");
    expect(missing).toContain("x-content-type-options");
  });
});

describe("requestIdMiddleware", () => {
  const makeContext = (existingId?: string) => {
    const headers: Record<string, string> = {};
    const req = {
      headers: existingId ? { "x-request-id": existingId } : {},
    } as any;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      headers,
    } as any;
    const next = jest.fn();
    return { req, res, next, headers };
  };

  it("sets X-Request-ID response header when enabled", () => {
    const { req, res, next, headers } = makeContext();
    requestIdMiddleware("X-Request-ID", true)(req, res, next);
    expect(headers["x-request-id"]).toBeDefined();
    expect(headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(next).toHaveBeenCalled();
  });

  it("preserves existing request ID from incoming request headers", () => {
    const existingId = "my-custom-id-123";
    const { req, res, next, headers } = makeContext(existingId);
    requestIdMiddleware("X-Request-ID", true)(req, res, next);
    expect(headers["x-request-id"]).toBe(existingId);
  });

  it("does nothing when disabled", () => {
    const { req, res, next, headers } = makeContext();
    requestIdMiddleware("X-Request-ID", false)(req, res, next);
    expect(headers["x-request-id"]).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("propagates request ID back to req.headers", () => {
    const { req, res, next } = makeContext();
    requestIdMiddleware("X-Request-ID", true)(req, res, next);
    expect(req.headers["x-request-id"]).toBeDefined();
  });
});

describe("apiVersionMiddleware", () => {
  it("sets API version header on every response", () => {
    const headers: Record<string, string> = {};
    const req = {} as any;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as any;
    const next = jest.fn();

    apiVersionMiddleware("X-API-Version", "v1")(req, res, next);

    expect(headers["X-API-Version"]).toBe("v1");
    expect(next).toHaveBeenCalled();
  });

  it("works with different version strings", () => {
    const headers: Record<string, string> = {};
    const req = {} as any;
    const res = {
      setHeader: (n: string, v: string) => {
        headers[n] = v;
      },
    } as any;
    const next = jest.fn();

    apiVersionMiddleware("X-API-Version", "v2")(req, res, next);
    expect(headers["X-API-Version"]).toBe("v2");
  });
});
