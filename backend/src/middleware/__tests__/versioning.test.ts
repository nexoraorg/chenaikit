import {
  detectVersion,
  versionHeaders,
  createVersionRouter,
  requireVersion,
} from "../versioning";
import type { Request, Response, NextFunction } from "express";
import { DEFAULT_VERSION, LATEST_VERSION } from "../../utils/versionUtils";

jest.mock("../../utils/logger", () => ({
  log: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

interface MockCtx {
  req: Request;
  res: Response;
  next: NextFunction;
  headers: Record<string, string>;
  statusCode?: number;
  jsonBody?: any;
}

const makeCtx = (
  opts: {
    url?: string;
    path?: string;
    header?: string;
    query?: Record<string, any>;
    apiVersion?: string;
  } = {},
): MockCtx => {
  const headers: Record<string, string> = {};
  const reqHeaders: Record<string, string> = {};
  if (opts.header) reqHeaders["accept-version"] = opts.header;

  const ctx: MockCtx = {
    headers,
    next: jest.fn() as unknown as NextFunction,
  } as MockCtx;

  ctx.req = {
    url: opts.url ?? opts.path ?? "/",
    path: opts.path ?? (opts.url ? opts.url.split("?")[0] : "/"),
    originalUrl: opts.url ?? opts.path ?? "/",
    query: opts.query ?? {},
    apiVersion: opts.apiVersion,
    header: (name: string) => reqHeaders[name.toLowerCase()],
  } as unknown as Request;

  ctx.res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = String(value);
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
    status: (code: number) => {
      ctx.statusCode = code;
      return ctx.res;
    },
    json: (body: any) => {
      ctx.jsonBody = body;
      return ctx.res;
    },
  } as unknown as Response;

  return ctx;
};

describe("detectVersion", () => {
  it("resolves version from the URL path and strips the prefix", () => {
    const ctx = makeCtx({ url: "/v2/accounts/123", path: "/v2/accounts/123" });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.apiVersion).toBe("v2");
    expect(ctx.req.apiVersionSource).toBe("path");
    expect(ctx.req.url).toBe("/accounts/123");
    expect(ctx.next).toHaveBeenCalled();
  });

  it("preserves the query string when stripping the path version", () => {
    const ctx = makeCtx({
      url: "/v1/credit-score?foo=bar",
      path: "/v1/credit-score",
    });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.url).toBe("/credit-score?foo=bar");
  });

  it("resolves version from the Accept-Version header", () => {
    const ctx = makeCtx({ path: "/accounts", header: "2" });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.apiVersion).toBe("v2");
    expect(ctx.req.apiVersionSource).toBe("header");
  });

  it("resolves version from a query parameter", () => {
    const ctx = makeCtx({ path: "/accounts", query: { version: "v2" } });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.apiVersion).toBe("v2");
    expect(ctx.req.apiVersionSource).toBe("query");
  });

  it("falls back to the default version when none is supplied", () => {
    const ctx = makeCtx({ path: "/accounts" });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.apiVersion).toBe(DEFAULT_VERSION);
    expect(ctx.req.apiVersionSource).toBe("default");
  });

  it("prefers the path over header and query", () => {
    const ctx = makeCtx({
      url: "/v2/accounts",
      path: "/v2/accounts",
      header: "v1",
      query: { version: "v1" },
    });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.req.apiVersion).toBe("v2");
  });

  it("rejects an explicit unsupported version with 400", () => {
    const ctx = makeCtx({ path: "/accounts", header: "v9" });
    detectVersion()(ctx.req, ctx.res, ctx.next);
    expect(ctx.statusCode).toBe(400);
    expect(ctx.jsonBody.error.code).toBe("UNSUPPORTED_API_VERSION");
    expect(ctx.next).not.toHaveBeenCalled();
  });
});

describe("versionHeaders", () => {
  it("sets version headers for the active version", () => {
    const ctx = makeCtx({ path: "/accounts", apiVersion: "v2" });
    versionHeaders()(ctx.req, ctx.res, ctx.next);
    expect(ctx.headers["x-api-version"]).toBe("v2");
    expect(ctx.headers["x-api-version-latest"]).toBe(LATEST_VERSION);
    expect(ctx.headers.deprecation).toBeUndefined();
    expect(ctx.next).toHaveBeenCalled();
  });

  it("emits deprecation warnings for a deprecated version", () => {
    const ctx = makeCtx({ path: "/accounts", apiVersion: "v1" });
    versionHeaders()(ctx.req, ctx.res, ctx.next);
    expect(ctx.headers.deprecation).toBeDefined();
    expect(ctx.headers.sunset).toBeDefined();
    expect(ctx.headers.warning).toContain("Deprecated API version v1");
    expect(ctx.headers.link).toContain('rel="deprecation"');
    expect(ctx.next).toHaveBeenCalled();
  });
});

describe("createVersionRouter", () => {
  it("dispatches to the router for the resolved version", () => {
    const v1 = jest.fn();
    const v2 = jest.fn();
    const ctx = makeCtx({ path: "/accounts", apiVersion: "v2" });
    createVersionRouter({ v1, v2 })(ctx.req, ctx.res, ctx.next);
    expect(v2).toHaveBeenCalled();
    expect(v1).not.toHaveBeenCalled();
  });

  it("falls back to the default version router", () => {
    const v1 = jest.fn();
    const ctx = makeCtx({ path: "/accounts", apiVersion: undefined });
    createVersionRouter({ v1 })(ctx.req, ctx.res, ctx.next);
    expect(v1).toHaveBeenCalled();
  });
});

describe("requireVersion", () => {
  it("passes through when the version matches", () => {
    const ctx = makeCtx({ path: "/feature", apiVersion: "v2" });
    requireVersion("v2")(ctx.req, ctx.res, ctx.next);
    expect(ctx.next).toHaveBeenCalled();
  });

  it("returns 404 when the version does not match", () => {
    const ctx = makeCtx({ path: "/feature", apiVersion: "v1" });
    requireVersion("v2")(ctx.req, ctx.res, ctx.next);
    expect(ctx.statusCode).toBe(404);
    expect(ctx.jsonBody.error.code).toBe("ENDPOINT_NOT_IN_VERSION");
  });
});
