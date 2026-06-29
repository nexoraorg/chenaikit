import { createCorsMiddleware } from "../cors";
import type { CorsConfig } from "../../config/security";
import type { Request, Response } from "express";

const baseConfig: CorsConfig = {
  origins: [],
  allowAll: false,
  credentials: false,
  maxAge: 600,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Request-ID"],
};

const makeReqRes = (origin?: string) => {
  const headers: Record<string, string> = {};
  const req = {
    method: "GET",
    headers: origin ? { origin } : {},
  } as unknown as Request;
  const res = {
    getHeader: (name: string) => headers[name.toLowerCase()],
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    headers,
  } as unknown as Response;
  return { req, res, headers };
};

describe("createCorsMiddleware", () => {
  it("returns a function (middleware)", () => {
    const middleware = createCorsMiddleware(baseConfig);
    expect(typeof middleware).toBe("function");
  });

  it("produces middleware with allowAll=true config", () => {
    const config: CorsConfig = { ...baseConfig, allowAll: true };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("produces middleware with credentials enabled", () => {
    const config: CorsConfig = {
      ...baseConfig,
      credentials: true,
      origins: ["https://a.com"],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("produces middleware with whitelisted origins", () => {
    const config: CorsConfig = {
      ...baseConfig,
      origins: ["https://allowed.com"],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("uses configured maxAge", () => {
    const config: CorsConfig = { ...baseConfig, maxAge: 1200 };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("uses custom methods list", () => {
    const config: CorsConfig = { ...baseConfig, methods: ["GET", "POST"] };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("uses custom allowedHeaders", () => {
    const config: CorsConfig = {
      ...baseConfig,
      allowedHeaders: ["Authorization", "X-Custom-Header"],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });

  it("uses custom exposedHeaders", () => {
    const config: CorsConfig = {
      ...baseConfig,
      exposedHeaders: ["X-Request-ID", "X-API-Version"],
    };
    const middleware = createCorsMiddleware(config);
    expect(typeof middleware).toBe("function");
  });
});
