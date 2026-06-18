import { getSecurityConfig } from "../security";

describe("getSecurityConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns default CORS config with empty origins when CORS_ORIGINS not set", () => {
    delete process.env.CORS_ORIGINS;
    const config = getSecurityConfig();
    expect(config.cors.origins).toEqual([]);
  });

  it("parses CORS_ORIGINS from environment", () => {
    process.env.CORS_ORIGINS = "https://a.com, https://b.com";
    const config = getSecurityConfig();
    expect(config.cors.origins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("allowAll is false in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ALLOW_ALL = "true";
    const config = getSecurityConfig();
    expect(config.cors.allowAll).toBe(false);
  });

  it("allowAll can be true in development", () => {
    process.env.NODE_ENV = "development";
    process.env.CORS_ALLOW_ALL = "true";
    const config = getSecurityConfig();
    expect(config.cors.allowAll).toBe(true);
  });

  it("returns HSTS config in production", () => {
    process.env.NODE_ENV = "production";
    const config = getSecurityConfig();
    expect(config.headers.hsts).not.toBe(false);
    if (config.headers.hsts) {
      expect(config.headers.hsts.maxAge).toBe(31536000);
      expect(config.headers.hsts.includeSubDomains).toBe(true);
      expect(config.headers.hsts.preload).toBe(true);
    }
  });

  it("disables HSTS outside of production", () => {
    process.env.NODE_ENV = "development";
    const config = getSecurityConfig();
    expect(config.headers.hsts).toBe(false);
  });

  it("returns default API version v1", () => {
    delete process.env.API_VERSION;
    const config = getSecurityConfig();
    expect(config.requestMeta.apiVersion).toBe("v1");
  });

  it("uses custom API_VERSION from environment", () => {
    process.env.API_VERSION = "v2";
    const config = getSecurityConfig();
    expect(config.requestMeta.apiVersion).toBe("v2");
  });

  it("trust proxy is undefined when not set", () => {
    delete process.env.TRUST_PROXY;
    const config = getSecurityConfig();
    expect(config.trustProxy).toBeUndefined();
  });

  it("parses numeric TRUST_PROXY", () => {
    process.env.TRUST_PROXY = "1";
    const config = getSecurityConfig();
    expect(config.trustProxy).toBe(1);
  });

  it("parses string TRUST_PROXY", () => {
    process.env.TRUST_PROXY = "loopback";
    const config = getSecurityConfig();
    expect(config.trustProxy).toBe("loopback");
  });

  it("includes all required CORS methods", () => {
    const config = getSecurityConfig();
    expect(config.cors.methods).toContain("GET");
    expect(config.cors.methods).toContain("POST");
    expect(config.cors.methods).toContain("OPTIONS");
  });

  it("includes X-Request-ID in exposed headers", () => {
    const config = getSecurityConfig();
    expect(config.cors.exposedHeaders).toContain("X-Request-ID");
  });

  it("includes X-Request-ID in allowed headers", () => {
    const config = getSecurityConfig();
    expect(config.cors.allowedHeaders).toContain("X-Request-ID");
  });
});
